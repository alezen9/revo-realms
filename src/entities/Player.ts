import {
  Mesh,
  MeshStandardMaterial,
  IcosahedronGeometry,
  Vector3,
  Quaternion,
  Camera,
} from "three";
import {
  ColliderDesc,
  RigidBody,
  RigidBodyDesc,
  World,
  Ray,
} from "@dimforge/rapier3d-compat";
import InputManager from "../systems/InputManager";
import { type State } from "../core/Engine";

export default class Player {
  private mesh: Mesh;
  private rigidBody: RigidBody;
  private inputManager: InputManager;

  // Camera smoothing
  private smoothedCameraPosition = new Vector3();
  private smoothedCameraTarget = new Vector3();

  // Yaw (rotation around Y-axis)
  private yawInRadians = 0;

  // Jump & Movement Configuration
  private readonly JUMP_IMPULSE = 5;
  private readonly JUMP_BUFFER_DURATION_IN_SECONDS = 0.2;
  private readonly MAX_CONSECUTIVE_JUMPS = 2;
  private readonly JUMP_CUT_MULTIPLIER = 0.3;
  private readonly FALL_MULTIPLIER = 1.5;
  private readonly MAX_UPWARD_VELOCITY = 6;
  private readonly LINEAR_DAMPING = 0.2;
  private readonly ANGULAR_DAMPING = 0.5;
  private readonly FORWARD_IMPULSE = 3; // base horizontal impulse
  private readonly TORQUE_STRENGTH = 1.5; // for rolling

  // Player State
  private isOnGround = false;
  private jumpCount = 0;
  private wasJumpHeld = false;
  private jumpBufferTimer = 0;

  // Constants for geometry/camera offset
  private readonly RADIUS = 0.5;
  private readonly PLAYER_INITIAL_POSITION = new Vector3(0, 2, 0);
  private readonly CAMERA_OFFSET = new Vector3(0, 5, 8);
  // private readonly CAMERA_OFFSET = new Vector3(0, 3, 17.5); // Debug camera
  private readonly UP = new Vector3(0, 1, 0);
  private readonly DOWN = new Vector3(0, -1, 0);

  constructor(state: State) {
    const { scene, world, inputManager } = state;
    this.inputManager = inputManager;

    this.mesh = this.createCharacterMesh();
    scene.add(this.mesh);

    this.rigidBody = world.createRigidBody(this.createRigidBodyDesc());
    world.createCollider(this.createColliderDesc(), this.rigidBody);
  }

  private createCharacterMesh() {
    const geometry = new IcosahedronGeometry(this.RADIUS, 3);
    // const material = new MeshPhongMaterial({
    //   color: "purple",
    //   flatShading: true,
    //   shininess: 150,
    //   specular: "#fcffb5",
    //   emissive: "red",
    //   emissiveIntensity: 1.1,
    // });
    const material = new MeshStandardMaterial({
      flatShading: true,
      color: "purple",
      // emissive: "purple",
      // emissiveIntensity: 15,
      metalness: 1,
      roughness: 0.5,
    });
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.copy(this.PLAYER_INITIAL_POSITION);
    return mesh;
  }

  private createRigidBodyDesc() {
    const { x, y, z } = this.PLAYER_INITIAL_POSITION;
    return RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setLinearDamping(this.LINEAR_DAMPING)
      .setAngularDamping(this.ANGULAR_DAMPING);
  }

  private createColliderDesc() {
    return ColliderDesc.ball(this.RADIUS).setRestitution(0.2).setFriction(1);
  }

  public update(state: State) {
    const { clock, camera, world } = state;
    const delta = clock.getDelta();

    this.updateVerticalMovement(delta, world);
    this.updateHorizontalMovement(delta);
    this.updateCameraPosition(camera, delta);
  }

  private updateVerticalMovement(delta: number, world: World) {
    const isJumpKeyPressed = this.inputManager.isKeyPressed(" ");

    // 1) Ground check
    this.isOnGround = this.checkIfGrounded(world);
    if (this.isOnGround) {
      this.jumpCount = 0;
    }

    // 2) Jump buffer
    const justPressedThisFrame = isJumpKeyPressed && !this.wasJumpHeld;
    if (justPressedThisFrame) {
      this.jumpBufferTimer = this.JUMP_BUFFER_DURATION_IN_SECONDS;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - delta);
    }

    // 3) Jump attempt
    if (this.jumpBufferTimer > 0 && this.canJump()) {
      this.performJump();
      this.jumpBufferTimer = 0;
    }

    // 4) Mid-air logic (jump cut, fast fall, clamp)
    const velocity = this.rigidBody.linvel() as Vector3;
    this.handleJumpCut(isJumpKeyPressed, velocity);
    this.handleFastFall(delta, velocity, world.gravity.y);
    this.clampUpwardVelocity(velocity);
    this.rigidBody.setLinvel(velocity, true);

    // 5) Save jump key state
    this.wasJumpHeld = isJumpKeyPressed;
  }

  private checkIfGrounded(world: World): boolean {
    // Cast a ray downward from just below the sphere’s center
    const pos = this.rigidBody.translation();
    const rayOrigin = new Vector3(pos.x, pos.y - (this.RADIUS + 0.01), pos.z);
    const ray = new Ray(rayOrigin, this.DOWN);

    const maxDistance = 0.2;
    const hit = world.castRay(ray, maxDistance, true);

    if (!hit) return false;

    const distanceToGround = hit.timeOfImpact * maxDistance;
    return distanceToGround < 0.01;
  }

  private canJump(): boolean {
    if (this.isOnGround) return true;
    return this.jumpCount < this.MAX_CONSECUTIVE_JUMPS;
  }

  private performJump() {
    const impulse = new Vector3(0, this.JUMP_IMPULSE, 0);
    this.rigidBody.applyImpulse(impulse, true);
    this.jumpCount += 1;
  }

  private handleJumpCut(isJumpKeyPressed: boolean, velocity: Vector3) {
    const justReleasedJump = !isJumpKeyPressed && this.wasJumpHeld;
    if (!justReleasedJump || velocity.y <= 0) return;
    velocity.y *= this.JUMP_CUT_MULTIPLIER;
  }

  private handleFastFall(delta: number, velocity: Vector3, gravityY: number) {
    if (velocity.y >= 0) return;
    const extraDown = this.FALL_MULTIPLIER * Math.abs(gravityY) * delta;
    velocity.y -= extraDown;
  }

  private clampUpwardVelocity(velocity: Vector3) {
    if (velocity.y <= this.MAX_UPWARD_VELOCITY) return;
    velocity.y = this.MAX_UPWARD_VELOCITY;
  }

  private updateHorizontalMovement(delta: number) {
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

    const turnSpeed = 2; // radians/sec
    if (isLeftward) this.yawInRadians += turnSpeed * delta;
    if (isRightward) this.yawInRadians -= turnSpeed * delta;

    const forwardVec = new Vector3(
      -Math.sin(this.yawInRadians),
      0,
      -Math.cos(this.yawInRadians),
    );

    const impulse = new Vector3();
    const torque = new Vector3();
    const torqueAxis = new Vector3()
      .crossVectors(this.UP, forwardVec)
      .normalize();

    if (isForward) {
      impulse.addScaledVector(forwardVec, this.FORWARD_IMPULSE * delta);
      torque.addScaledVector(torqueAxis, this.TORQUE_STRENGTH * delta);
    }
    if (isBackward) {
      impulse.addScaledVector(forwardVec, -this.FORWARD_IMPULSE * delta);
      torque.addScaledVector(torqueAxis, -this.TORQUE_STRENGTH * delta);
    }

    this.rigidBody.applyImpulse(impulse, true);
    this.rigidBody.applyTorqueImpulse(torque, true);

    this.syncMeshWithBody();
  }

  private syncMeshWithBody() {
    const position = this.rigidBody.translation();
    this.mesh.position.set(position.x, position.y, position.z);

    const rotation = this.rigidBody.rotation();
    this.mesh.quaternion.copy(rotation);
  }

  private updateCameraPosition(camera: Camera, delta: number) {
    // Build yaw quaternion
    const yawQuaternion = new Quaternion();
    yawQuaternion.setFromAxisAngle(this.UP, this.yawInRadians);

    // Rotate offset
    const offset = this.CAMERA_OFFSET.clone().applyQuaternion(yawQuaternion);

    // Desired camera pos
    const position = this.mesh.position.clone();
    const desiredCameraPosition = position.add(offset);

    // Lerp
    const lerpFactor = 7.5 * delta;
    this.smoothedCameraPosition.lerp(desiredCameraPosition, lerpFactor);

    // Lerp target as well
    const desiredTarget = this.mesh.position.clone();
    desiredTarget.y += 1;
    this.smoothedCameraTarget.lerp(desiredTarget, lerpFactor);

    // Assign to camera
    camera.position.copy(this.smoothedCameraPosition);
    camera.lookAt(this.smoothedCameraTarget);
  }

  public getPosition() {
    return this.mesh.position;
  }

  public getYaw() {
    return this.yawInRadians;
  }
}
