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
} from "@dimforge/rapier3d";
import { State } from "../core/Engine";
import Grass from "./Grass";
import {
  ClampToEdgeWrapping,
  MeshLambertNodeMaterial,
  RepeatWrapping,
} from "three/webgpu";
import materialNormalTextureUrl from "/forest/forest_ground_normal.jpg?url";
import materialDisplacementTextureUrl from "/forest/forest_ground_displacement.jpg?url";
import materialDiffuseTextureUrl from "/forest/forest_ground_diffuse.jpg?url";
import materialAOTextureUrl from "/forest/forest_ground_ao.jpg?url";
import {
  cameraPosition,
  fract,
  positionWorld,
  texture,
  uniform,
  uv,
  vec2,
} from "three/tsl";

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

  // Physics
  private mapRigidBody: RigidBody;
  private kintounRigidBody: RigidBody; // Kintoun = Flying Nimbus cloud from dragon ball

  // Material
  private materialNormalMap: Texture;
  private materialDisplacementMap: Texture;
  private materialDiffuseMap: Texture;
  private materialAOMap: Texture;

  private grass: Grass;

  private uTime = uniform(0);

  private dummy = new Object3D();

  constructor(state: State) {
    const { scene, world } = state;

    const loader = new TextureLoader();
    this.materialNormalMap = loader.load(materialNormalTextureUrl);
    this.materialDisplacementMap = loader.load(materialDisplacementTextureUrl);
    this.materialDiffuseMap = loader.load(materialDiffuseTextureUrl);
    this.materialAOMap = loader.load(materialAOTextureUrl);

    this.createInstancedTileGrid(scene);
    this.mapRigidBody = this.createMapCollider(world);
    this.kintounRigidBody = this.createKintounCollider(world);

    this.grass = new Grass(state);
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

    // Define how often the texture repeats per tile
    const uvScale = 1 / this.TILE_SIZE;

    // Calculate UVs based on world position to lock the texture
    const worldUV = vec2(
      positionWorld.x.mul(uvScale),
      positionWorld.z.mul(uvScale),
    ).fract(); // Keep UVs within [0, 1]

    // Apply the texture using the adjusted UVs
    materialNode.colorNode = texture(this.materialDiffuseMap, worldUV).rgb;

    materialNode.normalNode = texture(this.materialNormalMap, worldUV).rgb;
    materialNode.aoNode = texture(this.materialAOMap, worldUV).rgb;
    // materialNode.displacementMap = this.materialDisplacementMap;
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

    this.grass.update(state);

    // Move the entire floor opposite to the player's position
    this.instancedFloor.position.x = camera.position.x;
    this.instancedFloor.position.z = camera.position.z;
    this.instancedFloor.updateMatrixWorld();

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
