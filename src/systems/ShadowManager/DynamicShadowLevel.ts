import {
  Box3,
  DirectionalLight,
  Matrix4,
  Vector3,
  WebGPUCoordinateSystem,
} from "three";
import { uniform } from "three/tsl";
import { type DynamicShadowLevelSettings } from "./ShadowSettings";

const LIGHT_DISTANCE = 1024;
const DEPTH_PADDING = 4;
const DEPTH_QUANTIZATION = 1;

type AtlasRegion = {
  size: number;
  x: number;
  y: number;
};

export class DynamicShadowLevel {
  readonly atlasRegion: AtlasRegion;
  readonly light = new DirectionalLight();
  readonly settings: DynamicShadowLevelSettings;
  readonly uMatrix = uniform(new Matrix4());
  readonly viewProjectionMatrix = new Matrix4();
  private boundsCorner = new Vector3();
  private center = new Vector3();
  private lightForward = new Vector3();
  private lightPosition = new Vector3();
  private lightRight = new Vector3();
  private lightUp = new Vector3();
  private nextViewProjectionMatrix = new Matrix4();
  private receiverBounds = new Box3();
  private receiverMaxY: number;
  private receiverMinY: number;
  private isCentered = false;
  private snappedRight = 0;
  private snappedUp = 0;

  constructor(
    settings: DynamicShadowLevelSettings,
    atlasRegion: AtlasRegion,
    receiverMinY: number,
    receiverMaxY: number,
  ) {
    this.settings = settings;
    this.atlasRegion = atlasRegion;
    this.receiverMinY = receiverMinY;
    this.receiverMaxY = receiverMaxY;
    this.configureCamera();
  }

  applySettings() {
    this.isCentered = false;
  }

  includeReceiverBounds(bounds: Box3) {
    this.receiverMinY = Math.min(this.receiverMinY, bounds.min.y);
    this.receiverMaxY = Math.max(this.receiverMaxY, bounds.max.y);
    this.isCentered = false;
  }

  prepareProjection(playerPosition: Vector3, sunDirection: Vector3) {
    const { radius, recenterTexels, resolution } = this.settings;
    const receiverCenterY = (this.receiverMinY + this.receiverMaxY) * 0.5;
    const receiverHalfHeight = (this.receiverMaxY - this.receiverMinY) * 0.5;

    if (!this.lightForward.equals(sunDirection)) this.isCentered = false;
    this.lightForward.copy(sunDirection).normalize();
    this.lightRight.set(0, 1, 0).cross(this.lightForward);
    if (this.lightRight.lengthSq() === 0) this.lightRight.set(1, 0, 0);
    else this.lightRight.normalize();
    this.lightUp.crossVectors(this.lightForward, this.lightRight).normalize();

    this.center.set(playerPosition.x, receiverCenterY, playerPosition.z);
    const desiredRight = this.center.dot(this.lightRight);
    const desiredUp = this.center.dot(this.lightUp);
    const forwardDistance = this.center.dot(this.lightForward);
    const halfWidth = radius;
    const horizontalUpLength = Math.hypot(this.lightUp.x, this.lightUp.z);
    const halfHeight =
      radius * horizontalUpLength +
      receiverHalfHeight * Math.abs(this.lightUp.y);
    const texelX = (halfWidth * 2) / resolution;
    const texelY = (halfHeight * 2) / resolution;
    const thresholdX = texelX * recenterTexels;
    const thresholdY = texelY * recenterTexels;

    if (
      !this.isCentered ||
      Math.abs(desiredRight - this.snappedRight) >= thresholdX
    ) {
      this.snappedRight = Math.round(desiredRight / texelX) * texelX;
    }
    if (
      !this.isCentered ||
      Math.abs(desiredUp - this.snappedUp) >= thresholdY
    ) {
      this.snappedUp = Math.round(desiredUp / texelY) * texelY;
    }
    this.isCentered = true;

    this.center
      .copy(this.lightRight)
      .multiplyScalar(this.snappedRight)
      .addScaledVector(this.lightUp, this.snappedUp)
      .addScaledVector(this.lightForward, forwardDistance);
    this.light.target.position.copy(this.center);
    this.light.target.updateMatrixWorld();
    this.lightPosition
      .copy(this.lightForward)
      .multiplyScalar(-LIGHT_DISTANCE)
      .add(this.center);
    this.light.position.copy(this.lightPosition);
    this.light.updateMatrixWorld();

    const camera = this.light.shadow.camera;
    camera.position.copy(this.lightPosition);
    camera.lookAt(this.center);
    camera.updateMatrixWorld();
    camera.left = -halfWidth - thresholdX;
    camera.right = halfWidth + thresholdX;
    camera.bottom = -halfHeight - thresholdY;
    camera.top = halfHeight + thresholdY;

    this.receiverBounds.min.set(
      playerPosition.x - radius,
      this.receiverMinY,
      playerPosition.z - radius,
    );
    this.receiverBounds.max.set(
      playerPosition.x + radius,
      this.receiverMaxY,
      playerPosition.z + radius,
    );
  }

  finishProjection(casterBounds: readonly Box3[]) {
    const receiverDepth = this.getDepthRange(this.receiverBounds);
    let minDepth = receiverDepth.min;
    let maxDepth = receiverDepth.max;
    for (const bounds of casterBounds) {
      const depth = this.getDepthRange(bounds);
      minDepth = Math.min(minDepth, depth.min);
      maxDepth = Math.max(maxDepth, depth.max);
    }

    const camera = this.light.shadow.camera;
    camera.near = Math.max(
      0.1,
      Math.floor((minDepth - DEPTH_PADDING) / DEPTH_QUANTIZATION) *
        DEPTH_QUANTIZATION,
    );
    camera.far = Math.max(
      camera.near + DEPTH_QUANTIZATION,
      Math.ceil((maxDepth + DEPTH_PADDING) / DEPTH_QUANTIZATION) *
        DEPTH_QUANTIZATION,
    );
    camera.updateProjectionMatrix();
    this.light.shadow.updateMatrices(this.light);
    this.uMatrix.value.copy(this.light.shadow.matrix);
    this.nextViewProjectionMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    const hasChanged = !this.viewProjectionMatrix.equals(
      this.nextViewProjectionMatrix,
    );
    this.viewProjectionMatrix.copy(this.nextViewProjectionMatrix);
    return hasChanged;
  }

  getCoverage(bounds: Box3) {
    const camera = this.light.shadow.camera;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let index = 0; index < 8; index++) {
      this.boundsCorner
        .set(
          index & 1 ? bounds.max.x : bounds.min.x,
          index & 2 ? bounds.max.y : bounds.min.y,
          index & 4 ? bounds.max.z : bounds.min.z,
        )
        .applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, this.boundsCorner.x);
      maxX = Math.max(maxX, this.boundsCorner.x);
      minY = Math.min(minY, this.boundsCorner.y);
      maxY = Math.max(maxY, this.boundsCorner.y);
    }

    const overlapWidth = Math.max(
      0,
      Math.min(maxX, camera.right) - Math.max(minX, camera.left),
    );
    const overlapHeight = Math.max(
      0,
      Math.min(maxY, camera.top) - Math.max(minY, camera.bottom),
    );
    const projectionArea =
      (camera.right - camera.left) * (camera.top - camera.bottom);
    return (overlapWidth * overlapHeight) / projectionArea;
  }

  private getDepthRange(bounds: Box3) {
    let min = Infinity;
    let max = -Infinity;
    const camera = this.light.shadow.camera;
    for (let index = 0; index < 8; index++) {
      this.boundsCorner
        .set(
          index & 1 ? bounds.max.x : bounds.min.x,
          index & 2 ? bounds.max.y : bounds.min.y,
          index & 4 ? bounds.max.z : bounds.min.z,
        )
        .applyMatrix4(camera.matrixWorldInverse);
      const depth = -this.boundsCorner.z;
      min = Math.min(min, depth);
      max = Math.max(max, depth);
    }
    return { min, max };
  }

  private configureCamera() {
    const camera = this.light.shadow.camera;
    camera.name = `Dynamic shadows ${this.settings.name}`;
    camera.coordinateSystem = WebGPUCoordinateSystem;
  }
}
