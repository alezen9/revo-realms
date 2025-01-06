import {
  Mesh,
  MeshStandardMaterial,
  Scene,
  IcosahedronGeometry,
  Vector3,
  Clock,
} from "three";
import {
  ColliderDesc,
  RigidBody,
  RigidBodyDesc,
  World,
} from "@dimforge/rapier3d";
import InputManager from "./InputManager";

export default class Player {
  private mesh: Mesh;
  private rigidBody: RigidBody;
  private clock: Clock;
  private inputManager: InputManager;

  constructor(world: World, scene: Scene, clock: Clock) {
    this.clock = clock;
    this.inputManager = new InputManager();
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
    const rigidBody = RigidBodyDesc.dynamic()
      .setTranslation(0, 2, 0)
      .setLinearDamping(0.5)
      .setAngularDamping(0.5);
    return rigidBody;
  }

  private createCharacterColliderDesc() {
    const collider = ColliderDesc.ball(0.5).setRestitution(0.2).setFriction(1);
    return collider;
  }

  private move() {
    const isForward =
      this.inputManager.isKeyPressed("w") ||
      this.inputManager.isKeyPressed("arrowup");
    const isBackward =
      this.inputManager.isKeyPressed("s") ||
      this.inputManager.isKeyPressed("arrowdown");
    const isLeftward =
      this.inputManager.isKeyPressed("a") ||
      this.inputManager.isKeyPressed("arrowleft");
    const isRightward =
      this.inputManager.isKeyPressed("d") ||
      this.inputManager.isKeyPressed("arrowright");

    const delta = this.clock.getDelta();
    const impulseStrength = 1 * delta;
    const torqueStrength = 1.5 * delta;
    const impulse = new Vector3(0, 0, 0);
    const torque = new Vector3(0, 0, 0);

    if (isForward) {
      impulse.z -= impulseStrength; // Push forward
      torque.x -= torqueStrength; // Rotate backward (rolling forward)
    }
    if (isBackward) {
      impulse.z += impulseStrength; // Push backward
      torque.x += torqueStrength; // Rotate forward (rolling backward)
    }
    if (isLeftward) {
      impulse.x -= impulseStrength; // Push left
      torque.z += torqueStrength; // Rotate right (rolling left)
    }
    if (isRightward) {
      impulse.x += impulseStrength; // Push right
      torque.z -= torqueStrength; // Rotate left (rolling right)
    }

    // Apply impulse to the ball
    this.rigidBody.applyImpulse(impulse, true);
    this.rigidBody.applyTorqueImpulse(torque, true);
  }

  public update() {
    // Move
    this.move();

    // Update rranslation
    const position = this.rigidBody.translation();
    this.mesh.position.copy(position);

    // Update rotation
    const rotation = this.rigidBody.rotation();
    this.mesh.quaternion.copy(rotation);
  }
}
