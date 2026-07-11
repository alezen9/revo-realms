import { MathUtils, Mesh, Object3D, Quaternion, Vector3 } from "three";
import { playerConfig } from "./config";

export class PlayerSquash {
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

  noteJump() {
    this.jumpStretchImpulse = 1;
  }

  update(
    delta: number,
    velocity: Vector3,
    isOnGround: boolean,
    wasOnGround: boolean,
    isInWater: boolean,
    forwardDirection: Vector3,
  ) {
    this.velocityDelta.subVectors(velocity, this.previousVelocity);
    this.horizontalVelocity.set(velocity.x, 0, velocity.z);

    const didLand = !wasOnGround && isOnGround;
    if (didLand) {
      const landingSpeed = Math.max(0, -this.previousVelocity.y);
      const landingImpulse = MathUtils.clamp(
        landingSpeed / playerConfig.JUMP_VELOCITY_IN_METERS_PER_SECOND,
        0,
        1,
      );
      this.landingSquashImpulse = Math.max(
        this.landingSquashImpulse,
        landingImpulse,
      );
    }

    if (isOnGround) {
      const impactStrength = (this.velocityDelta.length() - 1.4) * 0.25;
      const impactImpulse = MathUtils.clamp(impactStrength, 0, 1);
      this.impactSquashImpulse = Math.max(
        this.impactSquashImpulse,
        impactImpulse,
      );
    }

    this.updateTarget(delta, isOnGround, isInWater, forwardDirection);
    this.previousVelocity.copy(velocity);
  }

  apply(
    delta: number,
    visualRoot: Object3D,
    mesh: Mesh,
    bodyQuaternion: Quaternion,
  ) {
    const t =
      1 -
      Math.exp(-playerConfig.SQUASH_RECOVERY_SPEED_IN_INVERSE_SECONDS * delta);
    this.squashScale.lerp(this.targetSquashScale, t);
    this.squashQuaternion.slerp(this.targetSquashQuaternion, t);

    visualRoot.scale.copy(this.squashScale);
    visualRoot.quaternion.copy(this.squashQuaternion);
    this.inverseSquashQuaternion.copy(this.squashQuaternion).invert();
    mesh.quaternion.copy(this.inverseSquashQuaternion).multiply(bodyQuaternion);
  }

  reset() {
    this.previousVelocity.set(0, 0, 0);
    this.squashScale.set(1, 1, 1);
    this.targetSquashScale.set(1, 1, 1);
    this.squashQuaternion.identity();
    this.targetSquashQuaternion.identity();
    this.jumpStretchImpulse = 0;
    this.landingSquashImpulse = 0;
    this.impactSquashImpulse = 0;
  }

  private updateTarget(
    delta: number,
    isOnGround: boolean,
    isInWater: boolean,
    forwardDirection: Vector3,
  ) {
    const squashMultiplier = isInWater
      ? playerConfig.WATER_SQUASH_MULTIPLIER
      : 1;
    const horizontalSpeed = this.horizontalVelocity.length();
    const horizontalAcceleration = Math.hypot(
      this.velocityDelta.x,
      this.velocityDelta.z,
    );
    const accelerationStretch =
      horizontalAcceleration *
      playerConfig.ACCELERATION_SQUASH_STRENGTH *
      squashMultiplier;
    const jumpStretch =
      this.jumpStretchImpulse *
      playerConfig.JUMP_STRETCH_STRENGTH *
      squashMultiplier;
    const landingSquash =
      this.landingSquashImpulse *
      playerConfig.LANDING_SQUASH_STRENGTH *
      squashMultiplier;
    const impactSquash =
      this.impactSquashImpulse *
      playerConfig.IMPACT_SQUASH_STRENGTH *
      squashMultiplier;
    const speedSquash =
      (isOnGround ? horizontalSpeed : 0) *
      playerConfig.GROUND_SPEED_SQUASH_STRENGTH *
      squashMultiplier;
    const squash = landingSquash + impactSquash + speedSquash;

    const squashScaleX =
      1 - accelerationStretch * 0.5 - jumpStretch * 0.45 + squash * 0.5;
    const squashScaleY = 1 - accelerationStretch * 0.25 + jumpStretch - squash;
    const squashScaleZ =
      1 + accelerationStretch - jumpStretch * 0.45 + squash * 0.5;
    this.targetSquashScale.set(squashScaleX, squashScaleY, squashScaleZ);
    this.clampTargetScale();
    this.updateDeformationDirection(horizontalSpeed, forwardDirection);
    this.decayImpulses(delta);
  }

  private updateDeformationDirection(
    horizontalSpeed: number,
    forwardDirection: Vector3,
  ) {
    if (horizontalSpeed > 0.05) {
      this.deformationDirection.copy(this.horizontalVelocity).normalize();
    } else {
      this.deformationDirection.copy(forwardDirection);
    }

    this.targetSquashQuaternion.setFromUnitVectors(
      playerConfig.FORWARD,
      this.deformationDirection,
    );
  }

  private clampTargetScale() {
    const minScale = 1 - playerConfig.MAX_SQUASH_DEFORMATION;
    const maxScale = 1 + playerConfig.MAX_SQUASH_DEFORMATION;
    const x = MathUtils.clamp(this.targetSquashScale.x, minScale, maxScale);
    const y = MathUtils.clamp(this.targetSquashScale.y, minScale, maxScale);
    const z = MathUtils.clamp(this.targetSquashScale.z, minScale, maxScale);

    this.targetSquashScale.set(x, y, z);
  }

  private decayImpulses(delta: number) {
    const decay = Math.exp(
      -playerConfig.SQUASH_RECOVERY_SPEED_IN_INVERSE_SECONDS * delta,
    );
    this.jumpStretchImpulse *= decay;
    this.landingSquashImpulse *= decay;
    this.impactSquashImpulse *= decay;
  }
}
