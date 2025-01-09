import { Scene, PlaneGeometry, MeshStandardMaterial, Mesh } from "three";
import { ColliderDesc, RigidBodyDesc, World } from "@dimforge/rapier3d";
import { State } from "../core/Engine";

const colors = ["red", "green", "blue", "yellow", "purple", "orange", "coral"];

export default class InfiniteFloor {
  // Configuration constants
  private readonly TILE_SIZE = 4;
  private readonly TILE_SUBDIVISION = 16;
  private readonly GRID_COUNT = 50;
  private readonly FLOOR_COLLIDER_HALF_HEIGHT = 0.3;

  // Internal state
  private tiles: Mesh[][] = [];
  private readonly halfGrid = Math.floor(this.GRID_COUNT / 2);

  constructor(state: State) {
    const { scene, world } = state;

    this.createTileGrid(world, scene);
  }

  /**
   * Initialize a grid of floor tiles centered around (0,0) in the XZ plane.
   * Each tile is a normal mesh that can receive shadows.
   */
  private createTileGrid(world: World, scene: Scene) {
    const geometry = new PlaneGeometry(
      this.TILE_SIZE,
      this.TILE_SIZE,
      this.TILE_SUBDIVISION,
      this.TILE_SUBDIVISION,
    );
    for (let rowIdx = 0; rowIdx < this.GRID_COUNT; rowIdx++) {
      this.tiles[rowIdx] = [];
      for (let colIdx = 0; colIdx < this.GRID_COUNT; colIdx++) {
        // Debug material
        const colorIdx = Math.floor(Math.random() * colors.length);
        const color = colors[colorIdx];
        const material = new MeshStandardMaterial({ color });

        const mesh = new Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2; // lay flat on ground

        // Position tiles in a grid centered at origin
        const x = (rowIdx - this.halfGrid) * this.TILE_SIZE;
        const z = (colIdx - this.halfGrid) * this.TILE_SIZE;
        mesh.position.set(x, 0, z);
        mesh.receiveShadow = true;

        scene.add(mesh);
        this.tiles[rowIdx][colIdx] = mesh;

        // Create physics collider for the floor
        const rigidBody = world.createRigidBody(
          this.createFloorRigidBodyDesc(x, z),
        );
        world.createCollider(this.createFloorColliderDesc(), rigidBody);
        mesh.userData = { rigidBody };
      }
    }
  }

  private createFloorRigidBodyDesc(x: number, z: number) {
    return RigidBodyDesc.fixed().setTranslation(
      x,
      -this.FLOOR_COLLIDER_HALF_HEIGHT,
      z,
    );
  }

  private createFloorColliderDesc() {
    const halfExtent = this.TILE_SIZE / 2;
    return ColliderDesc.cuboid(
      halfExtent,
      this.FLOOR_COLLIDER_HALF_HEIGHT,
      halfExtent,
    )
      .setFriction(1)
      .setRestitution(0.2);
  }

  /**
   * Update the position of floor tiles to simulate an infinite floor
   * based on the current camera position.
   */
  public update(state: State) {
    const { camera } = state;
    const camX = camera.position.x;
    const camZ = camera.position.z;
    const halfExtent = (this.GRID_COUNT * this.TILE_SIZE) / 2;

    // For each tile in the grid, reposition it if it's too far from the camera
    for (let rowIdx = 0; rowIdx < this.GRID_COUNT; rowIdx++) {
      for (let colIdx = 0; colIdx < this.GRID_COUNT; colIdx++) {
        const mesh = this.tiles[rowIdx][colIdx];
        let dx = mesh.position.x - camX;
        let dz = mesh.position.z - camZ;

        // If the tile is too far right/left of the camera, move it to the opposite side
        if (dx > halfExtent) {
          mesh.position.x -= this.GRID_COUNT * this.TILE_SIZE;
        } else if (dx < -halfExtent) {
          mesh.position.x += this.GRID_COUNT * this.TILE_SIZE;
        }
        // If the tile is too far in front/behind the camera, move it to the opposite side
        if (dz > halfExtent) {
          mesh.position.z -= this.GRID_COUNT * this.TILE_SIZE;
        } else if (dz < -halfExtent) {
          mesh.position.z += this.GRID_COUNT * this.TILE_SIZE;
        }
        const rigidBodyPosition = mesh.position.clone();
        rigidBodyPosition.y = -this.FLOOR_COLLIDER_HALF_HEIGHT;
        mesh.userData.rigidBody.setTranslation(rigidBodyPosition, true);
      }
    }
  }
}
