import { MathUtils, Mesh, Object3D, Quaternion, Vector3 } from "three";
import type { RigidBody } from "@dimforge/rapier3d";
import { physicsScheduler } from "../../systems";
import { playerConfig as config } from "./config";
import { FORWARD } from "../../utils/axes";

export class PlayerVisual {
  private visualRoot: Object3D;
  private mesh: Mesh;
  private rigidBody: RigidBody;

  private prevPosition = new Vector3();
  private targetPosition = new Vector3();
  private prevQuaternion = new Quaternion();
  private targetQuaternion = new Quaternion();
  private bodyQuaternion = new Quaternion();

  private previousVelocity = new Vector3();
  private velocityDelta = new Vector3();
  private horizontalVelocity = new Vector3();
  private deformationDirection = new Vector3(0, 0, -1);
  private squashQuaternion = new Quaternion();
  private targetSquashQuaternion = new Quaternion();
  private inverseSquashQuaternion = new Quaternion();
  private squashScale = new Vector3(1, 1, 1);
  private targetSquashScale = new Vector3(1, 1, 1);
  private jumpStretchImpulse = 0;
  private landingSquashImpulse = 0;
  private impactSquashImpulse = 0;
  private wasOnGround = false;

  constructor(visualRoot: Object3D, mesh: Mesh, rigidBody: RigidBody) {
    this.visualRoot = visualRoot;
    this.mesh = mesh;
    this.rigidBody = rigidBody;

    this.prevPosition.copy(rigidBody.translation());
    this.prevQuaternion.copy(rigidBody.rotation());
    this.targetPosition.copy(this.prevPosition);
    this.targetQuaternion.copy(this.prevQuaternion);
  }

  noteJump() {
    this.jumpStretchImpulse = 1;
  }

  capture(
    delta: number,
    isOnGround: boolean,
    isInWater: boolean,
    forwardDirection: Vector3,
  ) {
    const velocity = this.rigidBody.linvel();
    this.velocityDelta.subVectors(velocity, this.previousVelocity);
    this.horizontalVelocity.set(velocity.x, 0, velocity.z);

    const didLand = !this.wasOnGround && isOnGround;
    if (didLand) this.accumulateLanding();
    if (isOnGround) this.accumulateImpact();

    this.updateDeformationTarget(
      delta,
      isOnGround,
      isInWater,
      forwardDirection,
    );
    this.previousVelocity.copy(velocity);
    this.wasOnGround = isOnGround;

    this.prevPosition.copy(this.targetPosition);
    this.prevQuaternion.copy(this.targetQuaternion);
    this.targetPosition.copy(this.rigidBody.translation());
    this.targetQuaternion.copy(this.rigidBody.rotation());
  }

  interpolate(delta: number) {
    const { SQUASH_RECOVERY_SPEED_IN_INVERSE_SECONDS: recoverySpeed } = config;
    const { alpha } = physicsScheduler;
    const recoveryFactor = 1 - Math.exp(-recoverySpeed * delta);

    this.visualRoot.position.lerpVectors(
      this.prevPosition,
      this.targetPosition,
      alpha,
    );
    this.bodyQuaternion.slerpQuaternions(
      this.prevQuaternion,
      this.targetQuaternion,
      alpha,
    );

    this.squashScale.lerp(this.targetSquashScale, recoveryFactor);
    this.squashQuaternion.slerp(this.targetSquashQuaternion, recoveryFactor);

    this.visualRoot.scale.copy(this.squashScale);
    this.visualRoot.quaternion.copy(this.squashQuaternion);
    this.inverseSquashQuaternion.copy(this.squashQuaternion).invert();
    this.mesh.quaternion
      .copy(this.inverseSquashQuaternion)
      .multiply(this.bodyQuaternion);
  }

  reset() {
    const { PLAYER_INITIAL_POSITION } = config;

    this.prevPosition.copy(PLAYER_INITIAL_POSITION);
    this.targetPosition.copy(PLAYER_INITIAL_POSITION);
    this.prevQuaternion.identity();
    this.targetQuaternion.identity();
    this.bodyQuaternion.identity();

    this.visualRoot.position.copy(PLAYER_INITIAL_POSITION);
    this.visualRoot.scale.set(1, 1, 1);
    this.visualRoot.quaternion.identity();
    this.mesh.quaternion.identity();

    this.previousVelocity.set(0, 0, 0);
    this.squashScale.set(1, 1, 1);
    this.targetSquashScale.set(1, 1, 1);
    this.squashQuaternion.identity();
    this.targetSquashQuaternion.identity();
    this.jumpStretchImpulse = 0;
    this.landingSquashImpulse = 0;
    this.impactSquashImpulse = 0;
    this.wasOnGround = false;
  }

  private accumulateLanding() {
    const {
      LANDING_SQUASH_MIN_SPEED_IN_METERS_PER_SECOND: minSpeed,
      JUMP_VELOCITY_IN_METERS_PER_SECOND: maxSpeed,
    } = config;

    const landingSpeed = Math.max(0, -this.previousVelocity.y);
    const landingRatio = (landingSpeed - minSpeed) / (maxSpeed - minSpeed);
    const landingImpulse = MathUtils.clamp(landingRatio, 0, 1);
    this.landingSquashImpulse = Math.max(
      this.landingSquashImpulse,
      landingImpulse,
    );
  }

  private accumulateImpact() {
    const {
      IMPACT_SQUASH_MIN_DELTA_IN_METERS_PER_SECOND: minDelta,
      IMPACT_SQUASH_DELTA_TO_IMPULSE: deltaToImpulse,
    } = config;

    const excessDelta = this.velocityDelta.length() - minDelta;
    const impactImpulse = MathUtils.clamp(excessDelta * deltaToImpulse, 0, 1);
    this.impactSquashImpulse = Math.max(
      this.impactSquashImpulse,
      impactImpulse,
    );
  }

  private updateDeformationTarget(
    delta: number,
    isOnGround: boolean,
    isInWater: boolean,
    forwardDirection: Vector3,
  ) {
    const {
      ACCELERATION_SQUASH_STRENGTH: accelerationStrength,
      JUMP_STRETCH_STRENGTH: jumpStrength,
      LANDING_SQUASH_STRENGTH: landingStrength,
      IMPACT_SQUASH_STRENGTH: impactStrength,
      GROUND_SPEED_SQUASH_STRENGTH: speedStrength,
    } = config;

    let squashMultiplier = 1;
    if (isInWater) squashMultiplier = config.WATER_SQUASH_MULTIPLIER;

    const horizontalSpeed = this.horizontalVelocity.length();
    const groundSpeed = Number(isOnGround) * horizontalSpeed;
    const horizontalAcceleration = Math.hypot(
      this.velocityDelta.x,
      this.velocityDelta.z,
    );

    const stretch =
      horizontalAcceleration * accelerationStrength * squashMultiplier;
    const jumpStretch =
      this.jumpStretchImpulse * jumpStrength * squashMultiplier;
    const squash =
      (this.landingSquashImpulse * landingStrength +
        this.impactSquashImpulse * impactStrength +
        groundSpeed * speedStrength) *
      squashMultiplier;

    const scaleX = 1 - stretch * 0.5 - jumpStretch * 0.45 + squash * 0.5;
    const scaleY = 1 - stretch * 0.25 + jumpStretch - squash;
    const scaleZ = 1 + stretch - jumpStretch * 0.45 + squash * 0.5;

    this.targetSquashScale.set(scaleX, scaleY, scaleZ);
    this.clampTargetScale();
    this.updateDeformationDirection(horizontalSpeed, forwardDirection);
    this.decayImpulses(delta);
  }

  private updateDeformationDirection(
    horizontalSpeed: number,
    forwardDirection: Vector3,
  ) {
    const { DEFORMATION_ALIGN_MIN_SPEED_IN_METERS_PER_SECOND: minSpeed } =
      config;

    if (horizontalSpeed > minSpeed) {
      this.deformationDirection.copy(this.horizontalVelocity).normalize();
    } else {
      this.deformationDirection.copy(forwardDirection);
    }

    this.targetSquashQuaternion.setFromUnitVectors(
      FORWARD,
      this.deformationDirection,
    );
  }

  private clampTargetScale() {
    const { MAX_SQUASH_DEFORMATION: maxDeformation } = config;
    const minScale = 1 - maxDeformation;
    const maxScale = 1 + maxDeformation;
    const { x, y, z } = this.targetSquashScale;

    this.targetSquashScale.set(
      MathUtils.clamp(x, minScale, maxScale),
      MathUtils.clamp(y, minScale, maxScale),
      MathUtils.clamp(z, minScale, maxScale),
    );
  }

  private decayImpulses(delta: number) {
    const { SQUASH_RECOVERY_SPEED_IN_INVERSE_SECONDS: recoverySpeed } = config;
    const decay = Math.exp(-recoverySpeed * delta);

    this.jumpStretchImpulse *= decay;
    this.landingSquashImpulse *= decay;
    this.impactSquashImpulse *= decay;
  }
}
