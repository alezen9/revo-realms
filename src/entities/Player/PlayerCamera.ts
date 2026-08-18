import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import { UP } from "../../utils/axes";

export const playerCameraConfig = {
  OFFSET: new Vector3(0, 16, 20),
  TARGET_HEIGHT_IN_METERS: 1,
  POSITION_FOLLOW_SPEED_IN_INVERSE_SECONDS: 12,
  TARGET_FOLLOW_SPEED_IN_INVERSE_SECONDS: 18,
  ROTATION_FOLLOW_SPEED_IN_INVERSE_SECONDS: 10,
};

export class PlayerCamera {
  private camera: PerspectiveCamera;
  private smoothedPosition = new Vector3();
  private desiredPosition = new Vector3();
  private smoothedTarget = new Vector3();
  private desiredTarget = new Vector3();
  private yawInRadians = 0;
  private yawQuaternion = new Quaternion();

  constructor(camera: PerspectiveCamera) {
    this.camera = camera;
  }

  update(delta: number, focusPosition: Vector3, playerYawInRadians: number) {
    const {
      POSITION_FOLLOW_SPEED_IN_INVERSE_SECONDS: positionFollow,
      TARGET_FOLLOW_SPEED_IN_INVERSE_SECONDS: targetFollow,
      TARGET_HEIGHT_IN_METERS: targetHeight,
    } = playerCameraConfig;

    this.updateYaw(delta, playerYawInRadians);

    this.desiredPosition
      .copy(playerCameraConfig.OFFSET)
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

    this.camera.position.copy(this.smoothedPosition);
    this.camera.lookAt(this.smoothedTarget);
  }

  snapYaw(playerYawInRadians: number) {
    this.yawInRadians = playerYawInRadians;
    this.yawQuaternion.setFromAxisAngle(UP, this.yawInRadians);
  }

  private updateYaw(delta: number, playerYawInRadians: number) {
    const { ROTATION_FOLLOW_SPEED_IN_INVERSE_SECONDS: rotationFollow } =
      playerCameraConfig;

    const yawOffset = playerYawInRadians - this.yawInRadians;
    const yawDelta = Math.atan2(Math.sin(yawOffset), Math.cos(yawOffset));

    this.yawInRadians += yawDelta * (1 - Math.exp(-rotationFollow * delta));
    this.yawQuaternion.setFromAxisAngle(UP, this.yawInRadians);
  }
}
