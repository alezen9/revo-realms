import { Vector3, Mesh } from "three";
import {
  ColliderDesc,
  HeightFieldFlags,
  RigidBody,
  RigidBodyDesc,
} from "@dimforge/rapier3d";
import { State } from "../Game";
import {
  color,
  float,
  Fn,
  fract,
  mix,
  positionWorld,
  pow,
  rotate,
  smoothstep,
  texture,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { assetManager } from "../systems/AssetManager";
import WaterMaterial from "../materials/WaterMaterial";
import { MeshLambertNodeMaterial } from "three/webgpu";
import { UniformType } from "../types";
import Monuments from "../entities/Monuments";
import { physics } from "../systems/Physics";

const getConfig = () => {
  const MAP_SIZE = 256;
  return Object.freeze({
    MAP_SIZE,
    HALF_MAP_SIZE: MAP_SIZE / 2,
    KINTOUN_ACTIVATION_THRESHOLD: 2,
    HALF_FLOOR_THICKNESS: 0.3,
    OUTER_MAP_SIZE: MAP_SIZE * 3,
    OUTER_HALF_MAP_SIZE: MAP_SIZE * 1.5,
  });
};

export const realmConfig = getConfig();

export default class PortfolioRealm {
  private scene: State["scene"];

  private kintounRigidBody: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball
  private kintounPosition = new Vector3();
  private outerFloorMesh: Mesh;

  // Water
  private uTime = uniform(0);

  constructor(state: Pick<State, "scene">) {
    const { scene } = state;
    this.scene = scene;

    this.createFloor();
    this.createWater();
    new Monuments(state);

    this.outerFloorMesh = this.createOuterFloorVisual();
    this.scene.add(this.outerFloorMesh);

    this.kintounRigidBody = this.createKintoun();
  }

  private createOuterFloorVisual() {
    const outerFloor = assetManager.realmModel.scene.getObjectByName(
      "outer_world",
    ) as Mesh;
    outerFloor.material = new OuterFloorMaterial();
    return outerFloor;
  }

  private createFloor() {
    // Visual
    const floor = assetManager.realmModel.scene.getObjectByName(
      "floor",
    ) as Mesh;
    delete floor.geometry.attributes.normal;
    floor.material = new FloorMaterial({ uTime: this.uTime });
    floor.receiveShadow = true;
    this.scene.add(floor);
    // Physics
    this.createFloorPhysics();
  }
  private createWater() {
    // Visual
    const water = assetManager.realmModel.scene.getObjectByName(
      "water",
    ) as Mesh;
    delete water.geometry.attributes.normal;
    const waterMaterial = new WaterMaterial({
      uTime: this.uTime,
    });
    water.material = waterMaterial;
    this.scene.add(water);
  }

  private getFloorDisplacementData() {
    const mesh = assetManager.realmModel.scene.getObjectByName(
      "heightfield",
    ) as Mesh;
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

  private createFloorPhysics() {
    const displaceMentData = this.getFloorDisplacementData();
    const { rowsCount, heights, displacement } = displaceMentData;

    const rigidBodyDesc = RigidBodyDesc.fixed().setTranslation(
      0,
      -displacement,
      0,
    );
    const rigidBody = physics.world.createRigidBody(rigidBodyDesc);

    const colliderDesc = ColliderDesc.heightfield(
      rowsCount - 1,
      rowsCount - 1,
      heights,
      {
        x: realmConfig.MAP_SIZE,
        y: 1,
        z: realmConfig.MAP_SIZE,
      },
      HeightFieldFlags.FIX_INTERNAL_EDGES,
    )
      .setFriction(1)
      .setRestitution(0.2);

    physics.world.createCollider(colliderDesc, rigidBody);
  }

  private createKintoun() {
    const rigidBodyDesc = RigidBodyDesc.kinematicPositionBased().setTranslation(
      0,
      -20, // out of the physics world
      0,
    );
    const rigidBody = physics.world.createRigidBody(rigidBodyDesc);

    const halfSize = 2;

    const colliderDesc = ColliderDesc.cuboid(
      halfSize,
      realmConfig.HALF_FLOOR_THICKNESS,
      halfSize,
    )
      .setFriction(1)
      .setRestitution(0.2);
    physics.world.createCollider(colliderDesc, rigidBody);
    return rigidBody;
  }

  private useKintoun(playerPosition: Vector3) {
    this.kintounPosition
      .copy(playerPosition)
      .setY(-realmConfig.HALF_FLOOR_THICKNESS);
    this.kintounRigidBody.setTranslation(this.kintounPosition, true);
  }

  public update(state: State) {
    const { player, clock } = state;
    this.uTime.value = clock.getElapsedTime();

    const isPlayerNearEdgeX =
      realmConfig.HALF_MAP_SIZE - Math.abs(player.position.x) <
      realmConfig.KINTOUN_ACTIVATION_THRESHOLD;
    const isPlayerNearEdgeZ =
      realmConfig.HALF_MAP_SIZE - Math.abs(player.position.z) <
      realmConfig.KINTOUN_ACTIVATION_THRESHOLD;

    if (isPlayerNearEdgeX || isPlayerNearEdgeZ)
      this.useKintoun(player.position);

    const outerFloorThresold = realmConfig.MAP_SIZE;
    const absPlayerX = Math.abs(player.position.x);
    const dirX = Math.sign(player.position.x);
    const absPlayerZ = Math.abs(player.position.z);
    const dirZ = Math.sign(player.position.z);

    const dx =
      absPlayerX > outerFloorThresold ? absPlayerX - outerFloorThresold : 0;
    const dz =
      absPlayerZ > outerFloorThresold ? absPlayerZ - outerFloorThresold : 0;
    this.outerFloorMesh.position.set(dx * dirX, 0, dz * dirZ);
  }
}

type FloorUniforms = {
  uTime?: UniformType<number>;
};

const defaultUniforms: FloorUniforms = {
  uTime: uniform(0),
};

class FloorMaterial extends MeshLambertNodeMaterial {
  private _uniforms: FloorUniforms;
  constructor(uniforms: FloorUniforms) {
    super();

    this._uniforms = { ...defaultUniforms, ...uniforms };
    this.createMaterial();
  }

  private computeCausticsDiffuse = Fn(
    ([vUv = vec2(0, 0), causticsShadowColor = vec3(0, 0, 0)]) => {
      const timer = this._uniforms.uTime.mul(0.1);
      const scaleFactor = float(15);
      const scaledUv = vUv.mul(scaleFactor);
      const scaledCausticsUvA = fract(scaledUv.add(vec2(timer, 0)));
      const scaledCausticsUvB = fract(scaledUv.add(vec2(0, timer.negate())));
      const noiseA = texture(
        assetManager.voronoiNoiseTexture,
        scaledCausticsUvA,
        1,
      ).r;
      const noiseB = texture(
        assetManager.voronoiNoiseTexture,
        scaledCausticsUvB,
        2,
      ).r;
      const caustics = noiseA.add(noiseB);
      const adjustedCaustics = pow(caustics, 3);

      const causticsHighlightColor = vec3(1.2, 1.2, 0.8).mul(0.15);
      const causticsColor = mix(
        causticsShadowColor,
        causticsHighlightColor,
        adjustedCaustics,
      );

      return causticsColor;
    },
  );

  private computeWaterDiffuse = Fn(([vDepth = float(0), vUv = vec2(0, 0)]) => {
    const depth1 = float(5.0); // Transition depth
    const epsilon = float(0.001); // Prevents precision issues

    const blendFactor = smoothstep(0.0, depth1.add(epsilon), vDepth); // How much tint is applied

    const sandColor = color("#D8C098"); // Sand color
    const waterTint = sandColor.mul(0.5); // Blue-green tint in deeper water

    const waterBaseColor = sandColor.add(
      waterTint.sub(sandColor).mul(blendFactor),
    );

    const causticsColor = this.computeCausticsDiffuse(vUv);

    return waterBaseColor.add(causticsColor);
  });

  private createMaterial() {
    // Diffuse
    const _uv = positionWorld.xz
      .add(realmConfig.HALF_MAP_SIZE)
      .div(realmConfig.MAP_SIZE);
    const vUv = varying(_uv);

    const factors = texture(assetManager.floorGrassWaterMap, vUv, 2.5);

    const grassFactor = factors.g;
    const waterFactor = factors.b;
    const sandFactor = float(1).sub(grassFactor);
    const pathFactor = sandFactor.sub(waterFactor);

    const noiseFactor = texture(assetManager.randomNoiseTexture, _uv, 2).r;

    const grassColor = mix(color("#A3A16D"), color("#8C865A"), noiseFactor).mul(
      grassFactor,
    );

    const pathColor = mix(color("#D8C098"), color("#B89A77"), noiseFactor)
      .mul(2.25)
      .mul(pathFactor);

    const vDepth = varying(positionWorld.y.negate());
    const waterBaseColor = this.computeWaterDiffuse(vDepth, vUv);

    const waterColor = waterBaseColor.mul(waterFactor);

    this.colorNode = grassColor.add(pathColor).add(waterColor);

    // Normal
    const scaledSandUv1 = fract(_uv.mul(30));
    const scaledSandUv2 = fract(_uv.mul(-30));
    const normal1 = texture(assetManager.sandNormalTexture, scaledSandUv1);
    const normal2 = texture(assetManager.sandNormalTexture, scaledSandUv2);
    const rotatedNormal2 = rotate(normal2.rgb, vec3(1, 0, 0));

    this.normalNode = normal1.mul(rotatedNormal2);
  }
}

class OuterFloorMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.createMaterial();
  }

  private createMaterial() {
    const _uv = positionWorld.xz
      .add(realmConfig.HALF_MAP_SIZE)
      .div(realmConfig.MAP_SIZE);
    const modulatedUv = fract(_uv);
    const noise = texture(assetManager.randomNoiseTexture, modulatedUv, 2).r;

    const grassColor = mix(color("#A3A16D"), color("#8C865A"), noise);

    const scaledSandUv1 = fract(_uv.mul(30));
    const scaledSandUv2 = fract(_uv.mul(15));
    const normal1 = texture(assetManager.sandNormalTexture, scaledSandUv1);
    const normal2 = texture(assetManager.sandNormalTexture, scaledSandUv2);
    const rotatedNormal2 = rotate(normal2.rgb, vec3(1, 0, 0));

    this.normalNode = normal1.mul(rotatedNormal2);

    this.colorNode = grassColor;
  }
}
