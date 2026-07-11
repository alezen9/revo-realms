import { Quaternion, Vector3 } from "three";
import { sceneManager } from "../../systems";
import { playerConfig } from "./config";

export class PlayerCamera {
  private smoothedPosition = new Vector3();
  private desiredPosition = new Vector3();
  private smoothedTarget = new Vector3();
  private desiredTarget = new Vector3();
  private yawInRadians = 0;
  private yawQuaternion = new Quaternion();

  update(delta: number, focusPosition: Vector3, playerYawInRadians: number) {
    this.updateYaw(delta, playerYawInRadians);

    this.desiredPosition
      .copy(playerConfig.CAMERA_OFFSET)
      .applyQuaternion(this.yawQuaternion)
      .add(focusPosition);

    const positionLerpFactor =
      1 -
      Math.exp(
        -playerConfig.CAMERA_POSITION_FOLLOW_SPEED_IN_INVERSE_SECONDS * delta,
      );
    this.smoothedPosition.lerp(this.desiredPosition, positionLerpFactor);

    this.desiredTarget.copy(focusPosition);
    this.desiredTarget.y += 1;
    const targetLerpFactor =
      1 -
      Math.exp(
        -playerConfig.CAMERA_TARGET_FOLLOW_SPEED_IN_INVERSE_SECONDS * delta,
      );
    this.smoothedTarget.lerp(this.desiredTarget, targetLerpFactor);

    sceneManager.playerCamera.position.copy(this.smoothedPosition);
    sceneManager.playerCamera.lookAt(this.smoothedTarget);
  }

  snapYaw(playerYawInRadians: number) {
    this.yawInRadians = playerYawInRadians;
    this.yawQuaternion.setFromAxisAngle(playerConfig.UP, this.yawInRadians);
  }

  private updateYaw(delta: number, playerYawInRadians: number) {
    const yawDelta = Math.atan2(
      Math.sin(playerYawInRadians - this.yawInRadians),
      Math.cos(playerYawInRadians - this.yawInRadians),
    );
    const rotationLerpFactor =
      1 -
      Math.exp(
        -playerConfig.CAMERA_ROTATION_FOLLOW_SPEED_IN_INVERSE_SECONDS * delta,
      );

    this.yawInRadians += yawDelta * rotationLerpFactor;
    this.yawQuaternion.setFromAxisAngle(playerConfig.UP, this.yawInRadians);
  }
}
