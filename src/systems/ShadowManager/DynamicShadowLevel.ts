import {
  DirectionalLight,
  Matrix4,
  Vector3,
  WebGPUCoordinateSystem,
} from "three";
import { uniform } from "three/tsl";
import { type DynamicShadowLevelSettings } from "./ShadowSettings";

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
  private center = new Vector3();
  private lightForward = new Vector3();
  private lightPosition = new Vector3();
  private lightRight = new Vector3();
  private lightUp = new Vector3();
  private nextViewProjectionMatrix = new Matrix4();
  private isCentered = false;
  private snappedRight = 0;
  private snappedUp = 0;

  constructor(settings: DynamicShadowLevelSettings, atlasRegion: AtlasRegion) {
    this.settings = settings;
    this.atlasRegion = atlasRegion;
    this.configureCamera();
  }

  applySettings() {
    const camera = this.light.shadow.camera;
    const halfExtent = this.settings.radius * Math.SQRT2;
    camera.left = -halfExtent;
    camera.right = halfExtent;
    camera.bottom = -halfExtent;
    camera.top = halfExtent;
    camera.updateProjectionMatrix();
  }

  updateProjection(playerPosition: Vector3, sunDirection: Vector3) {
    const { radius, recenterTexels, resolution } = this.settings;
    const projectionSize = radius * Math.SQRT2 * 2;
    const texelSize = projectionSize / resolution;

    this.lightForward.copy(sunDirection).normalize();
    this.lightRight.set(0, 1, 0).cross(this.lightForward).normalize();
    this.lightUp.crossVectors(this.lightForward, this.lightRight).normalize();

    this.center.set(playerPosition.x, 16, playerPosition.z);
    const desiredRight = this.center.dot(this.lightRight);
    const desiredUp = this.center.dot(this.lightUp);
    const forwardDistance = this.center.dot(this.lightForward);
    const threshold = texelSize * recenterTexels;

    if (
      !this.isCentered ||
      Math.abs(desiredRight - this.snappedRight) >= threshold
    ) {
      this.snappedRight = Math.round(desiredRight / texelSize) * texelSize;
    }
    if (!this.isCentered || Math.abs(desiredUp - this.snappedUp) >= threshold) {
      this.snappedUp = Math.round(desiredUp / texelSize) * texelSize;
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
      .multiplyScalar(-128)
      .add(this.center);
    this.light.position.copy(this.lightPosition);
    this.light.updateMatrixWorld();
    this.light.shadow.updateMatrices(this.light);
    this.uMatrix.value.copy(this.light.shadow.matrix);
    this.nextViewProjectionMatrix.multiplyMatrices(
      this.light.shadow.camera.projectionMatrix,
      this.light.shadow.camera.matrixWorldInverse,
    );
    const hasChanged = !this.viewProjectionMatrix.equals(
      this.nextViewProjectionMatrix,
    );
    this.viewProjectionMatrix.copy(this.nextViewProjectionMatrix);
    return hasChanged;
  }

  private configureCamera() {
    const camera = this.light.shadow.camera;
    camera.name = `Dynamic shadows ${this.settings.name}`;
    camera.coordinateSystem = WebGPUCoordinateSystem;
    camera.near = 32;
    camera.far = 224;
    this.applySettings();
  }
}
