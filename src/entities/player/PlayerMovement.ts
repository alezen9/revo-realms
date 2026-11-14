import { Vector3 } from "three";
import { Ray, RigidBody, type Vector } from "@dimforge/rapier3d";
import { input, physicsWorld } from "../../systems";
import { DOWN, UP } from "../axes";
import type { PlayerBuoyancy } from "./PlayerBuoyancy";
import { playerConfig as config } from "./playerConfig";

export class PlayerMovement {
  private rigidBody: RigidBody;
  private buoyancy: PlayerBuoyancy;

  private yawInRadians = 0;
  private previousYawInRadians = 0;
  private linearVelocity = new Vector3();
  private angularVelocity = new Vector3();
  private forwardDirection = new Vector3();
  private jumpImpulse = new Vector3();
  private rayOrigin = new Vector3();
  private ray = new Ray(this.rayOrigin, DOWN);

  private isOnGround = false;
  private hasGroundContact = false;
  private jumpsRemaining = 0;
  private wasJumpHeld = false;
  private jumpBufferTimer = 0;
  private groundingLockTimer = 0;
  private hasJumped = false;

  constructor(rigidBody: RigidBody, buoyancy: PlayerBuoyancy) {
    this.rigidBody = rigidBody;
    this.buoyancy = buoyancy;
  }

  update(delta: number) {
    this.hasJumped = false;
    this.updateYaw(delta);
    this.applyHorizontalDamping(delta);
    this.updateVerticalMovement(delta);
    this.updateHorizontalMovement(delta);
    return this.hasJumped;
  }

  updateGrounding() {
    this.hasGroundContact = this.checkIfGrounded();
    this.isOnGround = this.groundingLockTimer === 0 && this.hasGroundContact;
  }

  resetJumps() {
    this.jumpsRemaining = 0;
  }

  private updateVerticalMovement(delta: number) {
    const isJumpKeyPressed = input.isJumpPressed();

    this.groundingLockTimer = Math.max(0, this.groundingLockTimer - delta);
    this.isOnGround = this.groundingLockTimer === 0 && this.hasGroundContact;

    if (this.isOnGround) this.jumpsRemaining = config.MAX_JUMPS;

    const justPressedThisFrame = isJumpKeyPressed && !this.wasJumpHeld;
    if (justPressedThisFrame) {
      this.jumpBufferTimer = config.JUMP_BUFFER_DURATION_IN_SECONDS;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - delta);
    }

    if (this.jumpBufferTimer > 0 && this.canJump()) {
      this.performJump();
      this.jumpBufferTimer = 0;
    }

    if (!this.buoyancy.isInWater) {
      this.updateVerticalVelocity(delta, isJumpKeyPressed);
    }
    this.wasJumpHeld = isJumpKeyPressed;
  }

  private updateVerticalVelocity(delta: number, isJumpKeyPressed: boolean) {
    const { linearVelocity } = this;
    this.rigidBody.linvel(linearVelocity);
    const initialVelocityY = linearVelocity.y;

    this.applyJumpCut(isJumpKeyPressed, linearVelocity);
    if (!this.isOnGround) {
      this.applyAirGravity(delta, linearVelocity, physicsWorld.world.gravity.y);
    }

    const isSlowBounce =
      Math.abs(linearVelocity.y) <
      config.BOUNCE_SETTLE_VERTICAL_SPEED_IN_METERS_PER_SECOND;
    const shouldSettleBounce =
      this.isOnGround && !isJumpKeyPressed && isSlowBounce;
    if (shouldSettleBounce) linearVelocity.y = 0;

    if (linearVelocity.y === initialVelocityY) return;
    this.rigidBody.setLinvel(linearVelocity, true);
  }

  private checkIfGrounded() {
    this.rigidBody.translation(this.rayOrigin);
    this.rayOrigin.y -=
      config.RADIUS_IN_METERS - config.GROUND_RAY_START_ABOVE_BOTTOM_IN_METERS;
    const hit = physicsWorld.world.castRay(
      this.ray,
      config.GROUND_RAY_MAX_DISTANCE_IN_METERS,
      true,
      undefined,
      undefined,
      undefined,
      this.rigidBody,
    );
    if (!hit) return false;
    return hit.timeOfImpact <= config.GROUND_CONTACT_THRESHOLD_IN_METERS;
  }

  private canJump() {
    if (this.buoyancy.isInWater && !this.isOnGround) return false;
    return this.jumpsRemaining > 0;
  }

  private performJump() {
    const isGroundJump = this.jumpsRemaining === config.MAX_JUMPS;
    let jumpVelocity = config.DOUBLE_JUMP_VELOCITY_IN_METERS_PER_SECOND;
    if (isGroundJump) jumpVelocity = config.JUMP_VELOCITY_IN_METERS_PER_SECOND;

    this.rigidBody.linvel(this.linearVelocity);
    const velocityChange = Math.max(0, jumpVelocity - this.linearVelocity.y);
    this.jumpImpulse.set(0, velocityChange * config.MASS_IN_KILOGRAMS, 0);
    this.rigidBody.applyImpulse(this.jumpImpulse, true);

    this.hasJumped = true;
    this.jumpsRemaining -= 1;
    this.groundingLockTimer = config.JUMP_GROUNDING_LOCK_TIME_IN_SECONDS;
    this.isOnGround = false;
  }

  private applyJumpCut(isJumpKeyPressed: boolean, velocity: Vector) {
    const justReleasedJump = !isJumpKeyPressed && this.wasJumpHeld;
    if (!justReleasedJump || velocity.y <= 0) return;
    velocity.y *= config.JUMP_CUT_MULTIPLIER;
  }

  private applyAirGravity(delta: number, velocity: Vector, gravityY: number) {
    let gravityMultiplier = config.RISE_GRAVITY_MULTIPLIER;
    if (velocity.y < 0) gravityMultiplier = config.FALL_GRAVITY_MULTIPLIER;
    velocity.y -= (gravityMultiplier - 1) * Math.abs(gravityY) * delta;
  }

  private applyHorizontalDamping(delta: number) {
    if (this.buoyancy.isInWater) return;
    const { linearVelocity } = this;
    this.rigidBody.linvel(linearVelocity);
    const damping = Math.exp(
      -config.HORIZONTAL_DAMPING_IN_INVERSE_SECONDS * delta,
    );
    linearVelocity.x *= damping;
    linearVelocity.z *= damping;
    this.rigidBody.setLinvel(linearVelocity, false);
  }

  private updateYaw(delta: number) {
    const { TURN_SPEED_IN_RADIANS_PER_SECOND: turnSpeed } = config;

    this.previousYawInRadians = this.yawInRadians;
    if (input.isLeftward()) this.yawInRadians += turnSpeed * delta;
    if (input.isRightward()) this.yawInRadians -= turnSpeed * delta;

    this.forwardDirection.set(
      -Math.sin(this.yawInRadians),
      0,
      -Math.cos(this.yawInRadians),
    );
  }

  private getMovementMultiplier() {
    if (this.buoyancy.isInWater) return config.WATER_MOVEMENT_MULTIPLIER;
    if (this.isOnGround) return 1;
    return config.AIR_CONTROL_FACTOR;
  }

  private updateHorizontalMovement(delta: number) {
    const isForward = input.isForward();
    const isBackward = input.isBackward();
    if (!isForward && !isBackward) return;

    const {
      ACCELERATION_IN_METERS_PER_SECOND_SQUARED: acceleration,
      MAX_SPEED_IN_METERS_PER_SECOND: maxSpeed,
      RADIUS_IN_METERS: radius,
    } = config;
    const { linearVelocity, angularVelocity, forwardDirection } = this;

    const driveSign = Number(isForward) - Number(isBackward);
    const velocityGain = acceleration * delta * this.getMovementMultiplier();

    this.rigidBody.linvel(linearVelocity);
    linearVelocity.addScaledVector(forwardDirection, velocityGain * driveSign);

    const horizontalSpeedSquared =
      linearVelocity.x ** 2 + linearVelocity.z ** 2;
    if (horizontalSpeedSquared > maxSpeed ** 2) {
      const scale = maxSpeed / Math.sqrt(horizontalSpeedSquared);
      linearVelocity.x *= scale;
      linearVelocity.z *= scale;
    }
    this.rigidBody.setLinvel(linearVelocity, true);

    if (!this.isOnGround && !this.buoyancy.isInWater) return;

    const forwardSpeed =
      linearVelocity.x * forwardDirection.x +
      linearVelocity.z * forwardDirection.z;
    const isDrifting = driveSign !== 0 && forwardSpeed * driveSign < 0;

    if (isDrifting) {
      const driftSpin =
        (driveSign * Math.abs(forwardSpeed) * config.DRIFT_SPIN_MULTIPLIER) /
        radius;
      angularVelocity
        .crossVectors(UP, forwardDirection)
        .multiplyScalar(driftSpin);
    } else {
      angularVelocity.crossVectors(UP, linearVelocity).divideScalar(radius);
    }
    this.rigidBody.setAngvel(angularVelocity, true);
  }

  get yaw() {
    return this.yawInRadians;
  }

  get previousYaw() {
    return this.previousYawInRadians;
  }

  get forward() {
    return this.forwardDirection;
  }

  get isGrounded() {
    return this.isOnGround;
  }
}
