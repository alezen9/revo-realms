import { ColliderDesc, RigidBodyDesc, World } from "@dimforge/rapier3d";
import {
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
} from "three";

export default class Floor {
  private readonly TILE_SIZE = 1;
  private readonly TILE_SUBDIVISIONS = 10;
  private readonly TILE_MULTIPLIER = 50;

  constructor(world: World, scene: Scene) {
    const tile = this.createTile();
    const floor = this.createFloor(tile);
    scene.add(floor);

    const rigidBody = world.createRigidBody(this.createFloorRigidBodyDesc());
    world.createCollider(this.createFloorColliderDesc(), rigidBody);
  }

  private createTile() {
    const geometry = new PlaneGeometry(
      this.TILE_SIZE,
      this.TILE_SIZE,
      this.TILE_SUBDIVISIONS,
      this.TILE_SUBDIVISIONS,
    );
    geometry.rotateX(-Math.PI / 2); // Make it horizontal
    const material = new MeshStandardMaterial({
      color: "green",
      wireframe: true,
    });
    const mesh = new Mesh(geometry, material);
    return mesh;
  }

  private createFloor(tile: Mesh) {
    const tilesCount = this.TILE_MULTIPLIER * this.TILE_MULTIPLIER; // Total number of tiles
    const instancedMesh = new InstancedMesh(
      tile.geometry,
      tile.material,
      tilesCount,
    );

    const halfSize = ((this.TILE_MULTIPLIER - 1) * this.TILE_SIZE) / 2;

    // Create transformation matrices for each instance
    for (let i = 0; i < tilesCount; i++) {
      const gridX = i % this.TILE_MULTIPLIER; // Column index
      const gridZ = Math.floor(i / this.TILE_MULTIPLIER); // Row index

      // Calculate the world position of a tile
      const posX = gridX * this.TILE_SIZE - halfSize;
      const posZ = gridZ * this.TILE_SIZE - halfSize;
      const matrix = new Matrix4().setPosition(posX, 0, posZ);

      instancedMesh.setMatrixAt(i, matrix);
    }

    return instancedMesh;
  }

  private createFloorRigidBodyDesc() {
    const rigidBody = RigidBodyDesc.fixed();
    return rigidBody;
  }

  private createFloorColliderDesc() {
    const size = this.TILE_MULTIPLIER * this.TILE_SIZE;
    const collider = ColliderDesc.cuboid(size / 2, 0.0001, size / 2)
      .setFriction(1)
      .setRestitution(0.2);
    return collider;
  }
}
