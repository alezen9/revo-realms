import { Mesh, IcosahedronGeometry, Vector3, Quaternion } from "three";
import {
  ColliderDesc,
  RigidBody,
  RigidBodyDesc,
  Ray,
  Vector,
} from "@dimforge/rapier3d";
import { inputManager } from "../systems/InputManager";
import { type State } from "../Game";
import {
  color,
  float,
  fract,
  positionWorld,
  sin,
  step,
  texture,
  uniform,
} from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import { UniformType } from "../types";
import { physics } from "../systems/Physics";
import { sceneManager } from "../systems/SceneManager";
import { lighting } from "../systems/LightingSystem";
import { eventsManager } from "../systems/EventsManager";

export default class Player {
  private mesh: Mesh;
  private rigidBody: RigidBody;

  // Camera smoothing
  private smoothedCameraPosition = new Vector3();
  private desiredCameraPosition = new Vector3();
  private smoothedCameraTarget = new Vector3();
  private desiredTargetPosition = new Vector3();

  // Yaw (rotation around Y-axis)
  private yawInRadians = 0;
  private prevYawInRadians = -1;
  private yawQuaternion = new Quaternion();

  // Jump & Movement Configuration
  private readonly JUMP_IMPULSE = 5;
  private readonly JUMP_BUFFER_DURATION_IN_SECONDS = 0.2;
  private readonly MAX_CONSECUTIVE_JUMPS = 2;
  private readonly JUMP_CUT_MULTIPLIER = 0.25;
  private readonly FALL_MULTIPLIER = 2.75;
  private readonly MAX_UPWARD_VELOCITY = 6;
  private readonly LINEAR_DAMPING = 0.25;
  private readonly ANGULAR_DAMPING = 1;
  private jumpImpulse = new Vector3(0, this.JUMP_IMPULSE, 0);

  private readonly LIN_VEL_STRENGTH = 25;
  private readonly ANG_VEL_STRENGTH = 25;
  private newLinVel = new Vector3();
  private newAngVel = new Vector3();
  private torqueAxis = new Vector3();
  private forwardVec = new Vector3();

  // Player State
  private isOnGround = false;
  private jumpCount = 0;
  private wasJumpHeld = false;
  private jumpBufferTimer = 0;

  // Constants for geometry/camera offset
  private readonly RADIUS = 0.5;
  private readonly PLAYER_INITIAL_POSITION = new Vector3(0, 5, 0);
  private readonly CAMERA_OFFSET = new Vector3(0, 12, 16);
  private readonly CAMERA_LERP_FACTOR = 7.5;
  private readonly UP = new Vector3(0, 1, 0);
  private readonly DOWN = new Vector3(0, -1, 0);
  private readonly FORWARD = new Vector3(0, 0, -1);

  private rayOrigin = new Vector3();
  private ray = new Ray(this.rayOrigin, this.DOWN);

  private uTime = uniform(0);

  constructor() {
    this.mesh = this.createCharacterMesh();
    sceneManager.scene.add(this.mesh);

    lighting.setTarget(this.mesh);

    this.rigidBody = physics.world.createRigidBody(this.createRigidBodyDesc());
    physics.world.createCollider(this.createColliderDesc(), this.rigidBody);

    eventsManager.on("update", this.update.bind(this));
  }

  private createCharacterMesh() {
    const geometry = new IcosahedronGeometry(this.RADIUS, 3);
    const material = new PlayerMaterial({ uTime: this.uTime });
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

  private update(state: State) {
    const { clock } = state;

    const delta = clock.getDelta();

    this.uTime.value = clock.getElapsedTime();

    if (this.prevYawInRadians !== this.yawInRadians) {
      this.yawQuaternion.setFromAxisAngle(this.UP, this.yawInRadians);
      this.prevYawInRadians = this.yawInRadians;
    }

    this.updateVerticalMovement(delta);
    this.updateHorizontalMovement(delta);
    this.updateCameraPosition(delta);
  }

  private updateVerticalMovement(delta: number) {
    const isJumpKeyPressed = inputManager.isKeyPressed(" ");

    // 1) Ground check
    this.isOnGround = this.checkIfGrounded();
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
    const velocity = this.rigidBody.linvel();
    this.handleJumpCut(isJumpKeyPressed, velocity);
    this.handleFastFall(delta, velocity, physics.world.gravity.y);
    this.clampUpwardVelocity(velocity);
    this.rigidBody.setLinvel(velocity, true);

    // 5) Save jump key state
    this.wasJumpHeld = isJumpKeyPressed;
  }

  private checkIfGrounded(): boolean {
    // Cast a ray downward from just below the sphere’s center
    this.rayOrigin.copy(this.rigidBody.translation());
    this.rayOrigin.y -= this.RADIUS + 0.01;
    const maxDistance = 0.2;
    const hit = physics.world.castRay(this.ray, maxDistance, true);
    if (!hit) return false;
    const distanceToGround = hit.timeOfImpact * maxDistance;
    return distanceToGround < 0.01;
  }

  private canJump(): boolean {
    if (this.isOnGround) return true;
    return this.jumpCount < this.MAX_CONSECUTIVE_JUMPS;
  }

  private performJump() {
    this.rigidBody.applyImpulse(this.jumpImpulse, true);
    this.jumpCount += 1;
  }

  private handleJumpCut(isJumpKeyPressed: boolean, velocity: Vector) {
    const justReleasedJump = !isJumpKeyPressed && this.wasJumpHeld;
    if (!justReleasedJump || velocity.y <= 0) return;
    velocity.y *= this.JUMP_CUT_MULTIPLIER;
  }

  private handleFastFall(delta: number, velocity: Vector, gravityY: number) {
    if (velocity.y >= 0) return;
    const extraDown = this.FALL_MULTIPLIER * Math.abs(gravityY) * delta;
    velocity.y -= extraDown;
  }

  private clampUpwardVelocity(velocity: Vector) {
    if (velocity.y <= this.MAX_UPWARD_VELOCITY) return;
    velocity.y = this.MAX_UPWARD_VELOCITY;
  }

  private updateHorizontalMovement(delta: number) {
    const isForward =
      inputManager.isKeyPressed("w") || inputManager.isKeyPressed("arrowup");
    const isBackward =
      inputManager.isKeyPressed("s") || inputManager.isKeyPressed("arrowdown");
    const isLeftward =
      inputManager.isKeyPressed("a") || inputManager.isKeyPressed("arrowleft");
    const isRightward =
      inputManager.isKeyPressed("d") || inputManager.isKeyPressed("arrowright");

    const turnSpeed = 2; // radians/sec
    if (isLeftward) this.yawInRadians += turnSpeed * delta;
    if (isRightward) this.yawInRadians -= turnSpeed * delta;

    this.forwardVec.copy(this.FORWARD).applyQuaternion(this.yawQuaternion);

    this.torqueAxis.crossVectors(this.UP, this.forwardVec).normalize();

    this.newLinVel.copy(this.rigidBody.linvel());
    this.newAngVel.copy(this.rigidBody.angvel());

    const linVelScale = this.LIN_VEL_STRENGTH * delta;
    const angVelScale = this.ANG_VEL_STRENGTH * delta;

    if (isForward) {
      this.newLinVel.addScaledVector(this.forwardVec, linVelScale);
      this.newAngVel.addScaledVector(this.torqueAxis, angVelScale);
    }
    if (isBackward) {
      this.newLinVel.addScaledVector(this.forwardVec, -linVelScale);
      this.newAngVel.addScaledVector(this.torqueAxis, -angVelScale);
    }

    this.rigidBody.setLinvel(this.newLinVel, true);
    this.rigidBody.setAngvel(this.newAngVel, true);

    this.syncMeshWithBody();
  }

  private syncMeshWithBody() {
    this.mesh.position.copy(this.rigidBody.translation());
    this.mesh.quaternion.copy(this.rigidBody.rotation());
  }

  private updateCameraPosition(delta: number) {
    // Rotate desired camera pos
    this.desiredCameraPosition
      .copy(this.CAMERA_OFFSET)
      .applyQuaternion(this.yawQuaternion)
      .add(this.mesh.position);

    // Lerp
    const lerpFactor = this.CAMERA_LERP_FACTOR * delta;
    this.smoothedCameraPosition.lerp(this.desiredCameraPosition, lerpFactor);

    // Lerp target as well
    this.desiredTargetPosition.copy(this.mesh.position);
    this.desiredTargetPosition.y += 1;
    this.smoothedCameraTarget.lerp(this.desiredTargetPosition, lerpFactor);

    // Assign to camera
    sceneManager.camera.position.copy(this.smoothedCameraPosition);
    sceneManager.camera.lookAt(this.smoothedCameraTarget);
  }

  get position() {
    return this.mesh.position;
  }

  get yaw() {
    return this.yawInRadians;
  }
}

class PlayerMaterial extends MeshStandardNodeMaterial {
  private _uniforms: { uTime: UniformType<number> };
  constructor(uniforms: { uTime: UniformType<number> }) {
    super();
    this._uniforms = { ...uniforms };
    this.createMaterial();
  }

  private createMaterial() {
    this.flatShading = true;

    this.roughness = 0.5;

    const noiseValue = texture(
      assetManager.noiseTexture,
      fract(positionWorld.xz),
      3,
    ).r;

    const timer = sin(this._uniforms.uTime.mul(2.5).add(noiseValue.mul(5))).mul(
      0.05,
    );

    const waterLevel = float(-0.15).add(timer);

    const underwaterFactor = float(1).sub(step(waterLevel, positionWorld.y));
    const abovewaterFactor = float(1).sub(underwaterFactor);

    const baseColor = color("silver");
    const aboveWater = baseColor.mul(abovewaterFactor);
    const underwaterTint = baseColor.mul(1.5).mul(underwaterFactor);

    const tintedColor = aboveWater.add(underwaterTint);

    this.colorNode = tintedColor;

    const aboveWaterMetalness = float(0.9).mul(abovewaterFactor);
    const underwaterMetalness = float(0.65).mul(underwaterFactor);
    this.metalnessNode = aboveWaterMetalness.add(underwaterMetalness);
  }
}
