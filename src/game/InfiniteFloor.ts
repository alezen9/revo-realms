import {
  TextureLoader,
  Texture,
  Vector3,
  BoxGeometry,
  DataTexture,
  Mesh,
  Vector2,
  MeshLambertMaterial,
} from "three";
import {
  ColliderDesc,
  RigidBody,
  RigidBodyDesc,
  World,
} from "@dimforge/rapier3d-compat";
import { State } from "../core/Engine";
import { MeshLambertNodeMaterial } from "three/webgpu";
import heightmapTextureUrlExr from "/environment/heightmap-super-small.exr?url";
import floorTextureUrl from "/environment/floor.webp?url";
import floorModelUrl from "/environment/floor.glb?url";
import {
  clamp,
  float,
  greaterThan,
  lessThan,
  mix,
  or,
  positionLocal,
  rotate,
  texture,
  uniform,
  vec3,
} from "three/tsl";
import {
  DRACOLoader,
  EXRLoader,
  GLTF,
  GLTFLoader,
} from "three/examples/jsm/Addons.js";
import Grass from "./Grass";

export default class InfiniteFloorInstanced {
  private readonly HALF_FLOOR_THICKNESS = 0.3;
  private readonly MAP_SIZE = 300;
  private readonly HALF_MAP_SIZE = this.MAP_SIZE / 2;
  private readonly KINTOUN_ACTIVATION_THRESHOLD = 2;

  // Mesh
  private floorTexture: Texture;
  private floor!: Mesh;

  // Physics
  // private mapRigidBody: RigidBody;
  private kintounRigidBody: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball

  private heightmapTexture: DataTexture;

  private grass: Grass;

  private uTime = uniform(0);
  private uWorldYaw = uniform(0);
  private uWorldPos = uniform(new Vector2());

  constructor(state: State) {
    const { scene, world } = state;

    const loader = new TextureLoader();
    this.floorTexture = loader.load(floorTextureUrl);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load(floorModelUrl, (model) => {
      this.floor = this.createFloorFromModel(model);
      scene.add(this.floor);
    });

    const exrLoader = new EXRLoader();
    this.heightmapTexture = exrLoader.load(heightmapTextureUrlExr, (t, d) => {
      // this.createMapHeightfieldCollider(world);
    });
    this.createMapCollider(world);
    this.kintounRigidBody = this.createKintounCollider(world);

    this.grass = new Grass(state);

    const cube = new Mesh(
      new BoxGeometry(),
      new MeshLambertMaterial({ color: "blue" }),
    );
    cube.position.y = 0.5;
    scene.add(cube);
  }

  private createFloorFromModel(model: GLTF) {
    const mesh = model.scene.children[0] as Mesh;
    mesh.receiveShadow = true;
    const material = this.createFloorMaterial();
    mesh.material = material;
    return mesh;
  }

  private getDataFromDisplacementMap() {
    const { width, height, data } = this.heightmapTexture.image;

    const maxEXRValue = 65535; // Max value for Uint16Array
    const maxBlenderHeight = 0.69; // Blender's height range
    const floorOffset = 0.14719; // Blender's "ground level"

    const heights = new Float32Array(width * height);
    const scale = 1 / maxEXRValue;
    let max = 0;
    let min = 0;
    for (let i = 0; i < width * height; i++) {
      // Normalize from [0, 65535] to [0, maxHeight]
      const normalizedHeight = data[i] * scale;
      heights[i] = normalizedHeight; // Adjust to set the floor at Y = 0
      if (heights[i] < min) min = heights[i];
      if (heights[i] > max) max = heights[i];
    }

    console.log(min, max);

    // console.log("Normalized heights:", heights.slice(0, 10));
    return { heights, width, height };
  }

  private createMapHeightfieldCollider(world: World) {
    const { heights, width, height } = this.getDataFromDisplacementMap();

    const scaleX = this.MAP_SIZE / (width - 1); // Scale to fit 300×300
    const scaleZ = this.MAP_SIZE / (height - 1);
    const maxHeight = 0.69; // Directly use Blender's max height
    const scaleY = 3; // 3 for debugging // 30 blenders plane, 300 map size

    // Move the collider up by the floor offset to match the visual mesh
    const floorOffset = 0.14719;

    const rigidBodyDesc = RigidBodyDesc.fixed().setTranslation(
      -this.HALF_MAP_SIZE,
      -floorOffset,
      this.HALF_MAP_SIZE,
    );
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = ColliderDesc.heightfield(
      height - 1, // 64 rows
      width - 1, // 64 columns
      heights, // Height data
      { x: scaleX, y: scaleY, z: scaleZ },
    );

    world.createCollider(colliderDesc, rigidBody);
  }

  private createMapCollider(world: World) {
    const rigidBodyDesc = RigidBodyDesc.fixed().setTranslation(
      0,
      -this.HALF_FLOOR_THICKNESS,
      0,
    );
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const halfMapSize = this.MAP_SIZE / 2;

    const colliderDesc = ColliderDesc.cuboid(
      halfMapSize,
      this.HALF_FLOOR_THICKNESS,
      halfMapSize,
    )
      .setFriction(1)
      .setRestitution(0.2);
    world.createCollider(colliderDesc, rigidBody);
    return rigidBody;
  }

  private createKintounCollider(world: World) {
    const rigidBodyDesc = RigidBodyDesc.fixed().setTranslation(
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

  private createFloorMaterial() {
    const materialNode = new MeshLambertNodeMaterial();

    const unrot = rotate(positionLocal, vec3(0, this.uWorldYaw, 0));
    const absoluteXZ = unrot.xz.add(this.uWorldPos);
    const uv = absoluteXZ.add(150).div(300);

    const clampedUV = clamp(uv, 0.0, 1.0);

    const colorNode = texture(this.floorTexture, clampedUV);

    const heightmapNode = texture(this.heightmapTexture, clampedUV);
    const blenderMaxHeight = 0.609;
    const blenderFloorOffset = 0.14719;
    const scale = 3;
    const scaledFloorOffset = (blenderFloorOffset / blenderMaxHeight) * scale;
    const displacedY = heightmapNode.r.mul(scale).sub(scaledFloorOffset);

    materialNode.positionNode = vec3(
      positionLocal.x,
      displacedY,
      positionLocal.z,
    );

    const isOutsideMap = or(
      or(
        lessThan(absoluteXZ.x, float(-this.HALF_MAP_SIZE)),
        greaterThan(absoluteXZ.x, float(+this.HALF_MAP_SIZE)),
      ),
      or(
        lessThan(absoluteXZ.y, float(-this.HALF_MAP_SIZE)),
        greaterThan(absoluteXZ.y, float(+this.HALF_MAP_SIZE)),
      ),
    );
    materialNode.colorNode = mix(
      colorNode.rgb,
      vec3(1.0, 0.0, 0.0),
      isOutsideMap,
    );

    return materialNode;
  }

  private useKintoun(playerPosition: Vector3) {
    const kintounPosition = playerPosition
      .clone()
      .setY(-this.HALF_FLOOR_THICKNESS);
    this.kintounRigidBody.setTranslation(kintounPosition, true);
  }

  public update(state: State) {
    const { clock, player } = state;
    if (!this.floor || !player) return;

    this.grass.update(state);

    this.uTime.value = clock.getElapsedTime();

    const playerPosition = player.getPosition();
    const playerYaw = player.getYaw();
    this.floor.position.x = playerPosition.x;
    this.floor.position.z = playerPosition.z;
    this.floor.rotation.y = playerYaw;

    this.uWorldPos.value.set(playerPosition.x, playerPosition.z);
    this.uWorldYaw.value = -playerYaw;

    const isPlayerNearEdgeX =
      this.HALF_MAP_SIZE - Math.abs(playerPosition.x) <
      this.KINTOUN_ACTIVATION_THRESHOLD;
    const isPlayerNearEdgeZ =
      this.HALF_MAP_SIZE - Math.abs(playerPosition.z) <
      this.KINTOUN_ACTIVATION_THRESHOLD;

    if (isPlayerNearEdgeX || isPlayerNearEdgeZ) this.useKintoun(playerPosition);
  }
}
