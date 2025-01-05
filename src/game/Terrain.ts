import { Mesh, MeshStandardMaterial, PlaneGeometry, Scene } from "three";
import {
  ColliderDesc,
  RigidBody,
  RigidBodyDesc,
  World,
} from "@dimforge/rapier3d";

export default class Terrain {
  private mesh: Mesh;
  private rigidBody: RigidBody;

  constructor(world: World, scene: Scene) {
    this.mesh = this.createCharacterMesh();
    scene.add(this.mesh);
    this.rigidBody = world.createRigidBody(this.createCharacterRigidBodyDesc());
    world.createCollider(this.createCharacterColliderDesc(), this.rigidBody);
  }

  private createCharacterMesh() {
    const geometry = new PlaneGeometry();
    const material = new MeshStandardMaterial({ color: "green" });
    const mesh = new Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2; // Make it horizontal
    mesh.scale.set(5, 5, 5);
    return mesh;
  }

  private createCharacterRigidBodyDesc() {
    const rigidBody = RigidBodyDesc.fixed();
    return rigidBody;
  }

  private createCharacterColliderDesc() {
    const collider = ColliderDesc.cuboid(5, 0.0001, 5);
    return collider;
  }
}
