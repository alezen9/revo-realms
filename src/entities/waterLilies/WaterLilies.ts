import {
  InstancedMesh,
  MathUtils,
  Matrix4,
  Quaternion,
  Sphere,
  Vector2,
  Vector3,
} from "three";
import { positionLocal, texture } from "three/tsl";
import { type State } from "../../Game";
import { assets, eventBus, graphics, stage } from "../../systems";
import { UP } from "../axes";
import { realmConfig } from "../realmConfig";
import { config, uniforms } from "./waterLiliesConfig";
import { debugWaterLilies } from "./waterLiliesDebug";
import { getLilyPosition, WaterLiliesMaterial } from "./WaterLiliesMaterial";

const {
  MAX_LILIES_PER_CLUSTER,
  PADS,
  SEED,
  FIRST_SIZE,
  COMPANION_SIZE,
  COMPANION_GAP,
  FLOAT_HEIGHT,
  ACTIVE_MARGIN,
  MAX_PRESS_HEIGHT,
  PRESS_RATE,
  PUSH_RADIUS,
  PUSH_SPEED,
} = config;

type Lily = {
  mesh: InstancedMesh;
  instanceId: number;
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  radius: number;
};

export class WaterLilies {
  private lilies: Lily[] = [];
  private activeArea = new Sphere();
  private awayFromPlayer = new Vector2();
  private matrix = new Matrix4();

  constructor() {
    const { waterLilyModel, terrainModel } = assets.resources;
    const clusters = assets.getObject("water-lilies", terrainModel);
    clusters.updateWorldMatrix(true, true);

    const material = new WaterLiliesMaterial();
    const capacity = clusters.children.length * MAX_LILIES_PER_CLUSTER;
    const meshes: InstancedMesh[] = [];
    for (const name of PADS) {
      const { geometry } = assets.getMesh(name, waterLilyModel);
      const mesh = new InstancedMesh(geometry, material, capacity);
      mesh.name = name;
      mesh.count = 0;
      mesh.frustumCulled = false;
      stage.mainScene.add(mesh);
      meshes.push(mesh);
    }

    MathUtils.seededRandom(SEED);
    const center = new Vector3();

    for (const cluster of clusters.children) {
      cluster.getWorldPosition(center);
      const count =
        1 + Math.floor(MathUtils.seededRandom() * MAX_LILIES_PER_CLUSTER);
      const firstSize = MathUtils.lerp(
        FIRST_SIZE.min,
        FIRST_SIZE.max,
        MathUtils.seededRandom(),
      );
      const firstDirection = MathUtils.seededRandom() * Math.PI * 2;

      for (let index = 0; index < count; index++) {
        const isFirst = index === 0;
        const companionSize = MathUtils.lerp(
          COMPANION_SIZE.min,
          COMPANION_SIZE.max,
          MathUtils.seededRandom(),
        );
        const size = isFirst ? firstSize : companionSize;
        const direction = firstDirection + (index * Math.PI * 2) / count;
        const companionDistance = (firstSize + size) / 2 + COMPANION_GAP;
        const distance = isFirst ? 0 : companionDistance;

        const meshIndex = Math.floor(MathUtils.seededRandom() * meshes.length);
        const mesh = meshes[meshIndex];
        const facing = MathUtils.seededRandom() * Math.PI * 2;
        const lily = {
          mesh,
          instanceId: mesh.count,
          position: new Vector3(
            center.x + Math.cos(direction) * distance,
            center.y + FLOAT_HEIGHT,
            center.z + Math.sin(direction) * distance,
          ),
          rotation: new Quaternion().setFromAxisAngle(UP, facing),
          scale: new Vector3().setScalar(size),
          radius: size / 2,
        };
        mesh.count++;
        this.place(lily);
        this.lilies.push(lily);
      }
    }

    for (const mesh of meshes) {
      const hasLilies = mesh.count > 0;
      if (!hasLilies) continue;
      graphics.vsmPass.registerCaster(mesh, {
        type: "dynamic",
        opacityNode: texture(assets.resources.waterLilyDiffuse).a,
        positionNode: getLilyPosition(positionLocal),
      });
    }

    this.activeArea.setFromPoints(this.lilies.map((lily) => lily.position));
    this.activeArea.radius += ACTIVE_MARGIN;

    eventBus.on("engine-render-update", this.onEngineUpdate);
    debugWaterLilies();
  }

  private onEngineUpdate = ({ player, delta }: State) => {
    const isPlayerNearLilies = this.activeArea.containsPoint(player.position);
    if (!isPlayerNearLilies) return;

    const heightAboveWater = player.position.y - this.activeArea.center.y;
    const isPlayerAtSurface = heightAboveWater < MAX_PRESS_HEIGHT;
    uniforms.uPlayerPosition.value.copy(player.position);
    uniforms.uPlayerPress.value = MathUtils.damp(
      uniforms.uPlayerPress.value,
      isPlayerAtSurface ? 1 : 0,
      PRESS_RATE,
      delta,
    );

    for (const lily of this.lilies) {
      const { position, radius } = lily;
      this.awayFromPlayer.set(
        position.x - player.position.x,
        position.z - player.position.z,
      );
      const distance = this.awayFromPlayer.length();
      const nearness = Math.max(0, 1 - distance / PUSH_RADIUS);
      const press = uniforms.uPlayerPress.value * nearness;
      const isPressed = press > 0;
      if (!isPressed) continue;

      this.awayFromPlayer.normalize();
      const step = press * PUSH_SPEED * delta;
      const nextX = position.x + this.awayFromPlayer.x * step;
      const nextZ = position.z + this.awayFromPlayer.y * step;

      const isRimOnWater = this.isWater(
        nextX + this.awayFromPlayer.x * radius,
        nextZ + this.awayFromPlayer.y * radius,
      );
      if (!isRimOnWater) continue;
      if (this.isTouchingAnotherLily(lily, nextX, nextZ)) continue;

      position.x = nextX;
      position.z = nextZ;
      this.place(lily);
    }
  };

  private place(lily: Lily) {
    const { mesh, instanceId, position, rotation, scale } = lily;
    mesh.setMatrixAt(
      instanceId,
      this.matrix.compose(position, rotation, scale),
    );
    mesh.instanceMatrix.needsUpdate = true;
  }

  private isTouchingAnotherLily(lily: Lily, x: number, z: number) {
    for (const other of this.lilies) {
      const isSameLily = other === lily;
      if (isSameLily) continue;
      const touchDistance = lily.radius + other.radius;
      const distance = Math.hypot(x - other.position.x, z - other.position.z);
      const isTouching = distance < touchDistance;
      if (isTouching) return true;
    }
    return false;
  }

  private isWater(x: number, z: number) {
    const { HALF_MAP_SIZE, MAP_SIZE } = realmConfig;
    const bits = assets.resources.waterMask;
    const resolution = Math.sqrt(bits.length * 8);
    const column = Math.floor(((x + HALF_MAP_SIZE) / MAP_SIZE) * resolution);
    const row = Math.floor(((z + HALF_MAP_SIZE) / MAP_SIZE) * resolution);
    const index = row * resolution + column;
    return (bits[index >> 3] & (1 << (index & 7))) !== 0;
  }
}
