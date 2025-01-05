import { Mesh, MeshStandardMaterial, Scene, IcosahedronGeometry } from "three";
import {
  ColliderDesc,
  RigidBody,
  RigidBodyDesc,
  World,
} from "@dimforge/rapier3d";

export default class Player {
  private mesh: Mesh;
  private rigidBody: RigidBody;

  constructor(world: World, scene: Scene) {
    this.mesh = this.createCharacterMesh();
    scene.add(this.mesh);
    this.rigidBody = world.createRigidBody(this.createCharacterRigidBodyDesc());
    world.createCollider(this.createCharacterColliderDesc(), this.rigidBody);
  }

  private createCharacterMesh() {
    const geometry = new IcosahedronGeometry(0.5, 2);
    const material = new MeshStandardMaterial({
      color: "purple",
      flatShading: true,
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.set(0, 2, 0);
    return mesh;
  }

  private createCharacterRigidBodyDesc() {
    const rigidBody = RigidBodyDesc.dynamic().setTranslation(0, 2, 0);
    return rigidBody;
  }

  private createCharacterColliderDesc() {
    const collider = ColliderDesc.ball(0.5).setRestitution(1.5);
    return collider;
  }

  public update() {
    const position = this.rigidBody.translation();
    this.mesh.position.set(position.x, position.y, position.z);
  }
}
