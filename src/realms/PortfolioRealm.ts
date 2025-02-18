import {
  Vector3,
  Mesh,
  InstancedMesh,
  MeshLambertMaterial,
  BatchedMesh,
} from "three";
import {
  ColliderDesc,
  HeightFieldFlags,
  RigidBody,
  RigidBodyDesc,
} from "@dimforge/rapier3d-compat";
import { State } from "../Game";
import {
  float,
  fract,
  mix,
  pow,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import { assetManager } from "../systems/AssetManager";
import WaterMaterial from "../materials/WaterMaterial";
import { MeshLambertNodeMaterial } from "three/webgpu";

const getConfig = () => {
  const MAP_SIZE = 256;
  return Object.freeze({
    MAP_SIZE,
    HALF_MAP_SIZE: MAP_SIZE / 2,
    KINTOUN_ACTIVATION_THRESHOLD: 2,
    HALF_FLOOR_THICKNESS: 0.3,
  });
};

export const realmConfig = getConfig();

export default class PortfolioRealm {
  private world: State["world"];
  private scene: State["scene"];

  private kintounRigidBody: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball
  private kintounPosition = new Vector3();

  // Water
  private uTime = uniform(0);

  constructor(state: Pick<State, "world" | "scene">) {
    const { world, scene } = state;
    this.world = world;
    this.scene = scene;
    scene.background = assetManager.environmentMap;
    scene.environment = assetManager.environmentMap;

    this.createFloor();
    this.createWater();
    this.createFences();

    this.kintounRigidBody = this.createKintoun();
  }

  private createFloor() {
    // Visual
    const floor = assetManager.realmModel.scene.getObjectByName(
      "floor",
    ) as Mesh;
    floor.geometry.computeVertexNormals();
    floor.material = this.createFloorMaterial();
    floor.receiveShadow = true;
    this.scene.add(floor);
    // Physics
    this.createFloorPhysics();
  }
  private createWater() {
    // Visual
    const lake = assetManager.realmModel.scene.getObjectByName("lake") as Mesh;
    const waterMaterial = new WaterMaterial({
      uTime: this.uTime,
    });
    lake.material = waterMaterial;
    this.scene.add(lake);
  }
  private createFences() {
    // Visual
    const fence = assetManager.realmModel.scene.getObjectByName(
      "fence",
    ) as Mesh;
    const fencePlaceholders = assetManager.realmModel.scene.children.filter(
      ({ name }) => name.startsWith("fence-placeholder"),
    ) as Mesh[];
    const fenceMaterial = new MeshLambertMaterial({
      map: assetManager.woodTexture,
    });
    fence.geometry.computeVertexNormals();
    fence.geometry.computeBoundingSphere();
    fence.geometry.computeBoundingBox();
    const totalFences = fencePlaceholders.length;
    const batchedMesh = new BatchedMesh(
      totalFences,
      fence.geometry.attributes.position.count * totalFences,
      (fence.geometry.index?.count ?? 0) * totalFences,
      fenceMaterial,
    );
    batchedMesh.sortObjects = false;
    const geomId = batchedMesh.addGeometry(fence.geometry);
    // const instances = new InstancedMesh(
    //   fence.geometry,
    //   fenceMaterial,
    //   fencePlaceholders.length,
    // );
    const placeholderHalfSize = new Vector3();
    fencePlaceholders[0].geometry.boundingBox
      ?.getSize(placeholderHalfSize)
      .divideScalar(2);

    for (let i = 0; i < fencePlaceholders.length; i++) {
      const placeholder = fencePlaceholders[i];
      const instanceId = batchedMesh.addInstance(geomId);
      batchedMesh.setMatrixAt(instanceId, placeholder.matrix);
      // instances.setMatrixAt(i, placeholder.matrix);
      // Physics
      this.createFencePhysics(placeholder, placeholderHalfSize);
    }
    this.scene.add(batchedMesh);
    // this.scene.add(instances);
  }

  private createFencePhysics(fencePlaceholder: Mesh, halfSize: Vector3) {
    const rigidBodyDesc = RigidBodyDesc.fixed()
      .setTranslation(...fencePlaceholder.position.toArray())
      .setRotation(fencePlaceholder.quaternion);
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);
    const colliderDesc = ColliderDesc.cuboid(...halfSize.toArray())
      .setFriction(1)
      .setRestitution(0.2);
    this.world.createCollider(colliderDesc, rigidBody);
  }

  private createFloorMaterial() {
    const material = new MeshLambertNodeMaterial();
    const causticsTexture = assetManager.voronoiNoiseTexture;
    const causticsMap = assetManager.realmCausticsMap;
    const floorTexture = assetManager.realmTexture;

    const timeFactor = this.uTime.mul(0.1);
    const scaleFactor = float(10);
    const scaledUv = uv().mul(scaleFactor);
    const scaledCausticsUvA = fract(scaledUv.add(vec2(timeFactor, 0)));
    const scaledCausticsUvB = fract(scaledUv.add(vec2(0, timeFactor.negate())));
    const noiseA = texture(causticsTexture, scaledCausticsUvA, 1).r;
    const noiseB = texture(causticsTexture, scaledCausticsUvB, 2).r;

    const caustics = noiseA.add(noiseB).mul(0.5);
    const adjustedCaustics = pow(caustics, 3);

    const mapColor = texture(floorTexture, uv());
    const causticsFactor = texture(causticsMap, uv()).r;

    const causticsHighlightColor = vec3(1.2, 1.2, 0.8);
    const causticsColor = mix(
      mapColor, // causticsShadowColor
      causticsHighlightColor,
      adjustedCaustics,
    );

    material.colorNode = mix(mapColor, causticsColor, causticsFactor);

    return material;
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
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

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

    this.world.createCollider(colliderDesc, rigidBody);
  }

  private createKintoun() {
    const rigidBodyDesc = RigidBodyDesc.kinematicPositionBased().setTranslation(
      0,
      -20, // out of the physics world
      0,
    );
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    const halfSize = 2;

    const colliderDesc = ColliderDesc.cuboid(
      halfSize,
      realmConfig.HALF_FLOOR_THICKNESS,
      halfSize,
    )
      .setFriction(1)
      .setRestitution(0.2);
    this.world.createCollider(colliderDesc, rigidBody);
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
  }
}
