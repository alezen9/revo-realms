import {
  PlaneGeometry,
  InstancedMesh,
  Object3D,
  Scene,
  TextureLoader,
  Texture,
  Vector3,
} from "three";
import {
  ColliderDesc,
  RigidBody,
  RigidBodyDesc,
  World,
} from "@dimforge/rapier3d-compat";
import { State } from "../core/Engine";
// import Grass from "./Grass";
import {
  DataTexture,
  Mesh,
  MeshLambertNodeMaterial,
  Vector2,
} from "three/webgpu";
import heightmapTextureUrl from "/environment/heightmap-super-small.webp?url";
import heightmapTextureUrlExr from "/environment/heightmap-super-small.exr?url";
import floorTextureUrl from "/environment/floor.webp?url";
import {
  add,
  float,
  greaterThan,
  lessThan,
  mix,
  or,
  positionLocal,
  texture,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import { EXRLoader } from "three/examples/jsm/Addons.js";

export default class InfiniteFloorInstanced {
  private readonly TILE_SIZE = 4;
  private readonly TILE_SUBDIVISION = 16;
  private readonly TILES_PER_SIDE = 50;
  private readonly HALF_TILES_PER_SIDE = Math.ceil(this.TILES_PER_SIDE / 2);
  private readonly HALF_FLOOR_THICKNESS = 0.3;

  private readonly MAP_SIZE = 300;
  private readonly HALF_MAP_SIZE = this.MAP_SIZE / 2;
  private readonly KINTOUN_ACTIVATION_THRESHOLD = 2;

  // Mesh
  private instancedFloor!: InstancedMesh;
  private mesh!: Mesh;
  private floorTexture: Texture;

  // Physics
  // private mapRigidBody: RigidBody;
  private kintounRigidBody: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball

  private heightmapTexture: DataTexture;

  // private grass: Grass;

  private uTime = uniform(0);
  private uOffset = uniform(new Vector2());

  private dummy = new Object3D();

  constructor(state: State) {
    const { scene, world } = state;

    const loader = new TextureLoader();
    this.floorTexture = loader.load(floorTextureUrl);
    loader.load(heightmapTextureUrl, (t) => {
      console.log(t);
    });

    const exrLoader = new EXRLoader();
    this.heightmapTexture = exrLoader.load(heightmapTextureUrlExr, (t, d) => {
      // this.createMapHeightfieldCollider(world);
    });
    this.createInstancedTileGrid(scene);
    // this.createFloorMesh(scene);
    this.createMapCollider(world);
    this.kintounRigidBody = this.createKintounCollider(world);

    // this.grass = new Grass(state);
  }

  private createFloorMesh(scene: Scene) {
    const geometry = new PlaneGeometry(
      this.TILE_SIZE * this.TILES_PER_SIDE,
      this.TILE_SIZE * this.TILES_PER_SIDE,
      this.TILE_SUBDIVISION * this.TILES_PER_SIDE,
      this.TILE_SUBDIVISION * this.TILES_PER_SIDE,
    );
    geometry.rotateX(-Math.PI / 2); // Plane facing up

    const material = this.createFloorMaterial();
    this.mesh = new Mesh(geometry, material);
    scene.add(this.mesh);
  }

  private createInstancedTileGrid(scene: Scene) {
    const geometry = new PlaneGeometry(
      this.TILE_SIZE,
      this.TILE_SIZE,
      this.TILE_SUBDIVISION,
      this.TILE_SUBDIVISION,
    );
    geometry.rotateX(-Math.PI / 2); // Plane facing up

    const material = this.createFloorMaterial();
    const totalTiles = this.TILES_PER_SIDE * this.TILES_PER_SIDE;

    this.instancedFloor = new InstancedMesh(geometry, material, totalTiles);
    this.instancedFloor.receiveShadow = true;
    this.instancedFloor.castShadow = true;

    const dummy = this.dummy;
    let instanceIdx = 0;

    for (let rowIdx = 0; rowIdx < this.TILES_PER_SIDE; rowIdx++) {
      const x = (rowIdx - this.HALF_TILES_PER_SIDE) * this.TILE_SIZE;
      for (let colIdx = 0; colIdx < this.TILES_PER_SIDE; colIdx++) {
        const z = (colIdx - this.HALF_TILES_PER_SIDE) * this.TILE_SIZE;
        dummy.position.set(x, 0, z);
        dummy.updateMatrix();
        this.instancedFloor.setMatrixAt(instanceIdx, dummy.matrix);
        instanceIdx++;
      }
    }
    this.instancedFloor.instanceMatrix.needsUpdate = true;
    scene.add(this.instancedFloor);
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

  // private getDataFromDisplacementMap() {
  //   const image = this.heightmapTexture.image;
  //   const canvas = document.createElement("canvas");
  //   const ctx = canvas.getContext("2d");

  //   if (!ctx)
  //     throw new Error(
  //       "Error extracting heights from displacement map, no canvas context provided.",
  //     );

  //   canvas.width = image.width;
  //   canvas.height = image.height;

  //   // Draw the texture onto the canvas
  //   ctx.drawImage(image, 0, 0);

  //   // Extract pixel data
  //   const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  //   // Convert pixel data to height values
  //   const totalSamples = canvas.width * canvas.height;
  //   const heights = new Float32Array(totalSamples);

  //   let flatIdx = 0;
  //   for (let y = 0; y < canvas.height; y++) {
  //     for (let x = 0; x < canvas.width; x++) {
  //       const pixelIndex = (y * canvas.width + x) * 3;
  //       const r = data[pixelIndex]; // Assuming grayscale (R == G == B)
  //       const height = r / 255; // Normalize to 0–1
  //       heights[flatIdx] = height;
  //       flatIdx++;
  //     }
  //   }

  //   return { heights, width: canvas.width, height: canvas.height };
  // }

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

    const blenderMaxHeight = 0.609;
    const blenderFloorOffset = 0.14719;
    const scale = 3;
    const scaledFloorOffset = (blenderFloorOffset / blenderMaxHeight) * scale;

    const absoluteXZ = add(positionLocal.xz, this.uOffset);

    const worldUV = vec2(
      add(absoluteXZ.x, this.HALF_MAP_SIZE).div(this.MAP_SIZE),
      add(absoluteXZ.y, this.HALF_MAP_SIZE).div(this.MAP_SIZE),
    );

    // Sample the heightmap using fully world-locked UVs
    const heightmapNode = texture(this.heightmapTexture, worldUV);

    // Detect if we're outside the map area
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

    // Apply heightmap displacement
    const adjustedHeight = heightmapNode.r.mul(scale).sub(scaledFloorOffset);

    // Apply the displacement
    materialNode.positionNode = vec3(
      positionLocal.x,
      adjustedHeight,
      positionLocal.z,
    );

    const colorNode = texture(this.floorTexture, worldUV);

    // Debug color: heightmap inside, red outside
    materialNode.colorNode = mix(
      colorNode.rgb, // Inside → heightmap
      vec3(1.0, 0.0, 0.0), // Outside → red
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
    const { clock, camera, player } = state;
    this.uTime.value = clock.getElapsedTime();

    // this.grass.update(state);

    // Move the entire floor opposite to the player's position
    this.instancedFloor.position.x = camera.position.x;
    this.instancedFloor.position.z = camera.position.z;
    this.instancedFloor.updateMatrixWorld();

    // this.mesh.position.x = camera.position.x;
    // this.mesh.position.z = camera.position.z;

    this.uOffset.value.x = camera.position.x;
    this.uOffset.value.y = camera.position.z;

    if (!player) return;
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
