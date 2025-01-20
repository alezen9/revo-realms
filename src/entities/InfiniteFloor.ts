import {
  Texture,
  Vector3,
  BoxGeometry,
  BufferGeometry,
  Mesh,
  MeshLambertMaterial,
} from "three";
import {
  ColliderDesc,
  HeightFieldFlags,
  RigidBody,
  RigidBodyDesc,
  World,
} from "@dimforge/rapier3d-compat";
import { State } from "../core/Engine";
import { MeshLambertNodeMaterial } from "three/webgpu";
import floor_TEMPORARY_TextureUrl from "/environment/sand-tmp.webp?url";
import floorModelUrl from "/environment/floor.glb?url";
import mapHeightfieldModelUrl from "/environment/model-heightmap.glb?url";
import {
  clamp,
  float,
  mix,
  positionWorld,
  step,
  texture,
  uniform,
  vec3,
} from "three/tsl";
import { GLTF } from "three/examples/jsm/Addons.js";
import Grass from "../entities/Grass";

export default class InfiniteFloorInstanced {
  private readonly HALF_FLOOR_THICKNESS = 0.3;
  private readonly MAP_SIZE = 300;
  private readonly HALF_MAP_SIZE = this.MAP_SIZE / 2;
  private readonly KINTOUN_ACTIVATION_THRESHOLD = 2;

  // Mesh
  private floorTexture: Texture;
  private floor!: Mesh;

  // Physics
  private kintounRigidBody: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball

  private grass: Grass;

  private uTime = uniform(0);

  constructor(state: State) {
    const { scene, world, assetManager } = state;

    (this.floorTexture = assetManager.textureLoader.load(
      floor_TEMPORARY_TextureUrl,
      (t) => {
        t.flipY = false;
      },
    )),
      (async () => {
        await Promise.all([
          assetManager.gltfLoader.loadAsync(floorModelUrl).then((model) => {
            this.floor = this.createFloorFromModel(model);
            scene.add(this.floor);
          }),
          assetManager.gltfLoader
            .loadAsync(mapHeightfieldModelUrl)
            .then((model) => {
              this.createHeightmapCollider(model, world);
            }),
        ]);
      })();

    this.kintounRigidBody = this.createKintounCollider(world);

    this.grass = new Grass(state);
  }

  private createFloorFromModel(model: GLTF) {
    const mesh = model.scene.children[0] as Mesh;
    mesh.receiveShadow = true;
    const material = this.createFloorMaterial();
    mesh.material = material;
    return mesh;
  }

  private getHeightfieldDataFromModel(geometry: BufferGeometry) {
    const positions = geometry.attributes.position.array;
    const totalCount = positions.length / 3;

    const gridSize = Math.sqrt(totalCount); // Assuming it's a square grid
    const subdivision = gridSize - 1;
    const heights = new Float32Array(totalCount);

    for (let i = 0; i < totalCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1]; // Height value
      const z = positions[i * 3 + 2];

      // Convert 3D positions into grid indices
      const indexX = Math.round((x / subdivision + 0.5) * (gridSize - 1));
      const indexZ = Math.round((z / subdivision + 0.5) * (gridSize - 1));

      const index = indexZ + indexX * gridSize;

      heights[index] = y;
    }

    return { heights, rows: gridSize - 1, cols: gridSize - 1 };
  }

  private createHeightmapCollider(model: GLTF, world: World) {
    const mapMesh = model.scene.children[0] as Mesh;
    const geometry = mapMesh.geometry;

    const { rows, cols, heights } = this.getHeightfieldDataFromModel(geometry);
    const rigidBodyDesc = RigidBodyDesc.fixed();
    const rigidBody = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = ColliderDesc.heightfield(
      rows,
      cols,
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

    // 1. Calculate the static UVs based on the rotated world position
    const uv = positionWorld.xz.add(this.HALF_MAP_SIZE).div(this.MAP_SIZE);
    const clampedUV = clamp(uv, 0.0, 1.0); // Prevent sampling outside the map

    // // 2. Sample the heightmap at the correct position
    // const heightmapSample = texture(this.heightmapTexture, clampedUV);
    // const heightValue = heightmapSample.r;

    // // 3. Apply displacement centered around zero
    // const displacedY = mix(-this.MAP_SCALE_Y, this.MAP_SCALE_Y, heightValue);

    // // 4. Set the displaced position to update the floor shape
    // const displacedPosition = vec3(
    //   positionLocal.x,
    //   displacedY,
    //   positionLocal.z,
    // );

    // materialNode.positionNode = displacedPosition;

    // 5. Sample the color texture in sync with the heightmap
    const colorSample = texture(this.floorTexture, clampedUV);

    // 6. Set color node based on inside / outside of the map
    const edgeX = step(-this.HALF_MAP_SIZE, positionWorld.x).mul(
      step(positionWorld.x, this.HALF_MAP_SIZE),
    );
    const edgeZ = step(-this.HALF_MAP_SIZE, positionWorld.z).mul(
      step(positionWorld.z, this.HALF_MAP_SIZE),
    );
    const isOutsideMap = float(1.0).sub(edgeX.mul(edgeZ)); // Returns 1.0 if outside, 0.0 if inside

    materialNode.colorNode = mix(
      colorSample.rgb,
      vec3(0.0, 0.0, 1.0),
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

    const isPlayerNearEdgeX =
      this.HALF_MAP_SIZE - Math.abs(playerPosition.x) <
      this.KINTOUN_ACTIVATION_THRESHOLD;
    const isPlayerNearEdgeZ =
      this.HALF_MAP_SIZE - Math.abs(playerPosition.z) <
      this.KINTOUN_ACTIVATION_THRESHOLD;

    if (isPlayerNearEdgeX || isPlayerNearEdgeZ) this.useKintoun(playerPosition);
  }
}
