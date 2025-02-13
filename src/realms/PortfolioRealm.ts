import {
  Vector3,
  Mesh,
  CubeTexture,
  MeshLambertMaterial,
  Group,
  Texture,
} from "three";
import {
  ColliderDesc,
  HeightFieldFlags,
  RigidBody,
  RigidBodyDesc,
  World,
} from "@dimforge/rapier3d-compat";
import { State } from "../Game";
import worldModelUrl from "/models/world.glb?url";
import floorTextureUrl from "/textures/realm/floor.webp?url";
import floorNormalTextureUrl from "/textures/realm/floor_normal.webp?url";
import { GLTF } from "three/examples/jsm/Addons.js";
import {
  float,
  fract,
  mix,
  positionWorld,
  texture,
  uniform,
  vec2,
} from "three/tsl";
import { assetManager } from "../systems/AssetManager";
import WaterMaterial from "../materials/WaterMaterial";
import { MeshLambertNodeMaterial } from "three/webgpu";

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
    // Map floor
    const floorTexture = assetManager.textureLoader.load(floorTextureUrl);
    floorTexture.flipY = false;
    const floorNormalTexture = assetManager.textureLoader.load(
      floorNormalTextureUrl,
    );
    const floor = worldModel.scene.getObjectByName("floor") as Mesh;
    floor.geometry.computeVertexNormals();
    floor.material = new MeshLambertMaterial({
      map: floorTexture,
      normalMap: floorNormalTexture,
    });
    floor.receiveShadow = true;
    scene.add(floor);

    // caustics
    // lakeBed.geometry.computeVertexNormals();
    // lakeBed.material = this.createLakeBedMaterial(floorTexture);
    // lakeBed.receiveShadow = true;
    // scene.add(lakeBed);

    // Water
    const lake = worldModel.scene.getObjectByName("lake") as Mesh;
    const waterMaterial = new WaterMaterial({
      uTime: this.uTime,
      uEnvironmentMap: this.uEnvironmentMap,
    });
    lake.material = waterMaterial;
    scene.add(lake);
  }

  private createLakeBedMaterial(floorTexture: Texture) {
    const material = new MeshLambertNodeMaterial();
    const causticsTexture = assetManager.voronoiNoiseTexture;

    const scaledUv = positionWorld.xz
      .add(float(this.HALF_MAP_SIZE))
      .div(this.MAP_SIZE);

    const mapColor = texture(floorTexture, scaledUv);

    const timeFactor = this.uTime.mul(0.1);
    const scaleFactor = float(10);

    const scaledCausticsUvA = fract(
      scaledUv.mul(scaleFactor).add(vec2(timeFactor, 0)),
    );
    const scaledCausticsUvB = fract(
      scaledUv.mul(scaleFactor).add(vec2(0, timeFactor.negate())),
    );

    const noiseA = texture(causticsTexture, scaledCausticsUvA, 1).r;
    const noiseB = texture(causticsTexture, scaledCausticsUvB, 2).r;
    const combinedNoise = noiseA.add(noiseB).mul(0.5);

    material.colorNode = mix(
      mapColor,
      mapColor.mul(0.6),
      float(1).sub(combinedNoise),
    );

    return material;
  }

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

    const isPlayerNearEdgeX =
      this.HALF_MAP_SIZE - Math.abs(player.position.x) <
      this.KINTOUN_ACTIVATION_THRESHOLD;
    const isPlayerNearEdgeZ =
      this.HALF_MAP_SIZE - Math.abs(player.position.z) <
      this.KINTOUN_ACTIVATION_THRESHOLD;

    if (isPlayerNearEdgeX || isPlayerNearEdgeZ)
      this.useKintoun(player.position);
  }
}
