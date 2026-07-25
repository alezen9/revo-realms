import { Quaternion, Vector3 } from "three";
import { sceneManager } from "../../systems";
import { playerConfig as config } from "./config";

export class PlayerCamera {
  private smoothedPosition = new Vector3();
  private desiredPosition = new Vector3();
  private smoothedTarget = new Vector3();
  private desiredTarget = new Vector3();
  private yawInRadians = 0;
  private yawQuaternion = new Quaternion();

  update(delta: number, focusPosition: Vector3, playerYawInRadians: number) {
    const {
      CAMERA_POSITION_FOLLOW_SPEED_IN_INVERSE_SECONDS: positionFollow,
      CAMERA_TARGET_FOLLOW_SPEED_IN_INVERSE_SECONDS: targetFollow,
      CAMERA_TARGET_HEIGHT_IN_METERS: targetHeight,
    } = config;

    this.updateYaw(delta, playerYawInRadians);

    this.desiredPosition
      .copy(config.CAMERA_OFFSET)
      .applyQuaternion(this.yawQuaternion)
      .add(focusPosition);
    this.smoothedPosition.lerp(
      this.desiredPosition,
      1 - Math.exp(-positionFollow * delta),
    );

    this.desiredTarget.copy(focusPosition);
    this.desiredTarget.y += targetHeight;
    this.smoothedTarget.lerp(
      this.desiredTarget,
      1 - Math.exp(-targetFollow * delta),
    );

    sceneManager.playerCamera.position.copy(this.smoothedPosition);
    sceneManager.playerCamera.lookAt(this.smoothedTarget);
  }

  snapYaw(playerYawInRadians: number) {
    this.yawInRadians = playerYawInRadians;
    this.yawQuaternion.setFromAxisAngle(config.UP, this.yawInRadians);
  }

  private updateYaw(delta: number, playerYawInRadians: number) {
    const { CAMERA_ROTATION_FOLLOW_SPEED_IN_INVERSE_SECONDS: rotationFollow } =
      config;

    const yawOffset = playerYawInRadians - this.yawInRadians;
    const yawDelta = Math.atan2(Math.sin(yawOffset), Math.cos(yawOffset));

    this.yawInRadians += yawDelta * (1 - Math.exp(-rotationFollow * delta));
    this.yawQuaternion.setFromAxisAngle(config.UP, this.yawInRadians);
  }
}
