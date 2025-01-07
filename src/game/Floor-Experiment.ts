import { ColliderDesc, RigidBodyDesc, World } from "@dimforge/rapier3d";
import {
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  Vector3,
  Camera,
  Group,
} from "three";

export default class Floor {
  private readonly TILE_SIZE = 10;
  private readonly TILE_MULTIPLIER = 50;
  private readonly TILE_COUNT = this.TILE_MULTIPLIER * this.TILE_MULTIPLIER;

  private lodGroup: Group;

  constructor(world: World, scene: Scene, camera: Camera) {
    this.lodGroup = new Group();

    const highLOD = this.createInstancedMesh(50);
    const mediumLOD = this.createInstancedMesh(20);
    const lowLOD = this.createInstancedMesh(3);

    this.lodGroup.add(highLOD, mediumLOD, lowLOD);
    scene.add(this.lodGroup);

    this.update(camera);

    const rigidBody = world.createRigidBody(this.createFloorRigidBodyDesc());
    world.createCollider(this.createFloorColliderDesc(), rigidBody);
  }

  private createTileGeometry(subdivisions: number) {
    const geometry = new PlaneGeometry(
      this.TILE_SIZE,
      this.TILE_SIZE,
      subdivisions,
      subdivisions,
    );
    geometry.rotateX(-Math.PI / 2); // Make it horizontal
    return geometry;
  }

  private createInstancedMesh(subdivisions: number) {
    const geometry = this.createTileGeometry(subdivisions);
    const material = new MeshStandardMaterial({
      color: "green",
      wireframe: true,
    });

    const instancedMesh = new InstancedMesh(
      geometry,
      material,
      this.TILE_COUNT,
    );

    const halfSize = ((this.TILE_MULTIPLIER - 1) * this.TILE_SIZE) / 2;

    for (let i = 0; i < this.TILE_COUNT; i++) {
      const gridX = i % this.TILE_MULTIPLIER; // Column index
      const gridZ = Math.floor(i / this.TILE_MULTIPLIER); // Row index

      // Calculate the world position of a tile
      const posX = gridX * this.TILE_SIZE - halfSize;
      const posZ = gridZ * this.TILE_SIZE - halfSize;

      const matrix = new Matrix4().setPosition(posX, 0, posZ);
      instancedMesh.setMatrixAt(i, matrix);
    }

    instancedMesh.instanceMatrix.needsUpdate = true; // Ensure the transformation matrices are applied

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

  public update(camera: Camera) {
    const cameraPosition = new Vector3().setFromMatrixPosition(
      camera.matrixWorld,
    );
    const center = new Vector3(0, 0, 0); // Assuming the floor is centered at origin
    const distance = cameraPosition.distanceTo(center);

    // Industry-standard distances for LOD
    const highDistance = 10; // High detail within 50 units
    const mediumDistance = 30; // Medium detail within 150 units

    this.lodGroup.children.forEach((child, index) => {
      if (child instanceof InstancedMesh) {
        switch (index) {
          case 0: // High LOD
            child.visible = distance <= highDistance;
            break;
          case 1: // Medium LOD
            child.visible = distance <= mediumDistance;
            break;
          case 2: // Low LOD
            child.visible = distance > mediumDistance;
            break;
        }
      }
    });
  }
}
