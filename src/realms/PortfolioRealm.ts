import { Vector3, Mesh, CubeTexture } from "three";
import {
  ColliderDesc,
  HeightFieldFlags,
  RigidBody,
  RigidBodyDesc,
  World,
} from "@dimforge/rapier3d-compat";
import { State } from "../Game";
import { MeshStandardMaterial } from "three/webgpu";
import worldModelUrl from "/environment/world.glb?url";
import floorTextureUrl from "/environment/floor.webp?url";
import { GLTF } from "three/examples/jsm/Addons.js";
import { debugManager } from "../systems/DebugManager";
import { uniform } from "three/tsl";
import { assetManager } from "../systems/AssetManager";
import WaterMaterial from "../utils/WaterMaterial";

export default class PortfolioRealm {
  private readonly HALF_FLOOR_THICKNESS = 0.3;
  private readonly MAP_SIZE = 256;
  private readonly HALF_MAP_SIZE = this.MAP_SIZE / 2;
  private readonly KINTOUN_ACTIVATION_THRESHOLD = 2;

  private kintounRigidBody: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball
  private kintounPosition = new Vector3();

  // Water
  private uTime = uniform(0);
  private uEnvironmentMap = new CubeTexture();

  constructor(
    state: Pick<State, "world" | "scene" | "environmentalIllumination">,
  ) {
    const { world, scene, environmentalIllumination } = state;

    this.uEnvironmentMap.copy(environmentalIllumination.environmentMap);

    assetManager.gltfLoader.load(worldModelUrl, (worldModel) => {
      this.createPhysics(worldModel, world);
      this.createVisual(worldModel, scene);
    });

    this.kintounRigidBody = this.createKintounCollider(world);
  }

  private createVisual(worldModel: GLTF, scene: State["scene"]) {
    const floorTexture = assetManager.textureLoader.load(floorTextureUrl);
    floorTexture.flipY = false;

    const floor = worldModel.scene.getObjectByName("floor") as Mesh;
    floor.geometry.computeVertexNormals();
    floor.material = new MeshStandardMaterial({ map: floorTexture });
    floor.receiveShadow = true;
    scene.add(floor);

    const lake = worldModel.scene.getObjectByName("lake") as Mesh;
    const waterMaterial = new WaterMaterial({
      uTime: this.uTime,
      uEnvironmentMap: this.uEnvironmentMap,
    });
    debugManager.panel.addBinding(waterMaterial, "wireframe", {
      label: "Wireframe",
    });
    lake.material = waterMaterial;
    scene.add(lake);
  }

  // private permute = Fn(([x = vec4(0, 0, 0, 0)]) => {
  //   return mod(x.mul(34).add(1).mul(x), 289);
  // });

  // private snoise2d = Fn(([v = vec2(0, 0)]) => {
  //   const C = vec4(
  //     0.211324865405187,
  //     0.366025403784439,
  //     -0.577350269189626,
  //     0.024390243902439,
  //   );
  //   let i = floor(v.add(dot(v, C.yy)));
  //   const x0 = v.sub(i).add(dot(i, C.xx));
  //   let i1 = vec2(step(x0.y, x0.x), step(x0.x, x0.y));
  //   let x12 = vec4(x0.xyxy.add(C.xxzz));
  //   x12 = vec4(x12.xy.sub(i1), x12.zw);
  //   i = mod(i, 289);
  //   const p = this.permute(
  //     this.permute(i.y.add(vec3(0, i1.y, 1)))
  //       .add(i.x)
  //       .add(vec3(0, i1.x, 1)),
  //   );
  //   let m = vec3(
  //     max(
  //       float(0.5).sub(
  //         vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
  //       ),
  //       0,
  //     ),
  //   );
  //   m = m.mul(m);
  //   m = m.mul(m);
  //   const x = float(2).mul(fract(p.mul(C.www)).sub(1));
  //   const h = abs(x).sub(0.5);
  //   const ox = floor(x.add(0.5));
  //   const a0 = x.sub(ox);
  //   m = m.mul(
  //     float(1.79284291400159).sub(
  //       float(0.85373472095314).mul(a0.mul(a0).add(h.mul(h))),
  //     ),
  //   );
  //   let g = vec3(
  //     a0.x.mul(x0.x).add(h.x.mul(x0.y)),
  //     a0.yz.mul(x12.xz).add(h.yz.mul(x12.yw)),
  //   );
  //   // g.x = a0.x.mul(x0.x).add(h.x.mul(x0.y))
  //   // g.yz = a0.yz.mul(x12.xz).add(h.yz.mul(x12.yw))

  //   return float(130).mul(dot(m, g));
  // });

  private getDisplacementData(worldModel: GLTF) {
    const mesh = worldModel.scene.getObjectByName("heightfield") as Mesh;
    const displacement = mesh.geometry.attributes._displacement.array[0]; // they are all the same
    const positionAttribute = mesh.geometry.attributes.position;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const boundingBoxAttribute = mesh.geometry.boundingBox!;
    const totalCount = positionAttribute.count;
    const rowsCount = Math.sqrt(totalCount);

    // half extent of the plane size, plane is a square centred at 0,0 in Blender <- IMPORTANT
    const halfExtent = boundingBoxAttribute.max.x;

    const heights = new Float32Array(totalCount);

    for (let i = 0; i < totalCount; i++) {
      const x = positionAttribute.array[i * 3 + 0]; // in [-halfExtent..+halfExtent]
      const y = positionAttribute.array[i * 3 + 1]; // in [0, someHeight]
      const z = positionAttribute.array[i * 3 + 2]; // in [-halfExtent..+halfExtent]

      // Map x from [-halfExtent..+halfExtent] to [0..1] => index in [0..(rowsCount - 1)]
      const indexX = Math.round((x / (halfExtent * 2) + 0.5) * (rowsCount - 1));
      const indexZ = Math.round((z / (halfExtent * 2) + 0.5) * (rowsCount - 1));

      // col-major: row = indexZ, col = indexX
      const index = indexZ + indexX * rowsCount;

      heights[index] = y;
    }

    return {
      rowsCount,
      heights,
      displacement,
    };
  }

  private createPhysics(worldModel: GLTF, world: World) {
    const displaceMentData = this.getDisplacementData(worldModel);
    const { rowsCount, heights, displacement } = displaceMentData;

    const rigidBodyDesc = RigidBodyDesc.fixed().setTranslation(
      0,
      -displacement,
      0,
    );
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = ColliderDesc.heightfield(
      rowsCount - 1,
      rowsCount - 1,
      heights,
      {
        x: this.MAP_SIZE,
        y: 1,
        z: this.MAP_SIZE,
      },
      HeightFieldFlags.FIX_INTERNAL_EDGES,
    )
      .setFriction(1)
      .setRestitution(0.2);

    world.createCollider(colliderDesc, rigidBody);
  }

  private createKintounCollider(world: World) {
    const rigidBodyDesc = RigidBodyDesc.kinematicPositionBased().setTranslation(
      0,
      -20, // out of the physics world
      0,
    );
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const halfSize = 2;

    const colliderDesc = ColliderDesc.cuboid(
      halfSize,
      this.HALF_FLOOR_THICKNESS,
      halfSize,
    )
      .setFriction(1)
      .setRestitution(0.2);
    world.createCollider(colliderDesc, rigidBody);
    return rigidBody;
  }

  private useKintoun(playerPosition: Vector3) {
    this.kintounPosition.copy(playerPosition).setY(-this.HALF_FLOOR_THICKNESS);
    this.kintounRigidBody.setTranslation(this.kintounPosition, true);
  }

  public update(state: State) {
    const { player, clock } = state;
    this.uTime.value = clock.getElapsedTime();

    const playerPosition = player.getPosition();

    const isPlayerNearEdgeX =
      this.HALF_MAP_SIZE - Math.abs(playerPosition.x) <
      this.KINTOUN_ACTIVATION_THRESHOLD;
    const isPlayerNearEdgeZ =
      this.HALF_MAP_SIZE - Math.abs(playerPosition.z) <
      this.KINTOUN_ACTIVATION_THRESHOLD;

    if (isPlayerNearEdgeX || isPlayerNearEdgeZ) this.useKintoun(playerPosition);
  }
}
