import { eventsManager, sceneManager } from "../systems";
import { Frustum, Matrix4, Mesh } from "three";

export class Utils {
  static frustum = new Frustum();
  static projScreenMatrix = new Matrix4();

  static isMeshVisible = (obj: Mesh) => {
    if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere();
    return this.frustum.intersectsObject(obj);
  };

  /**
   * Call only once
   */
  static init() {
    eventsManager.on("engine-update-throttle-16x", () => {
      this.projScreenMatrix.multiplyMatrices(
        sceneManager.playerCamera.projectionMatrix,
        sceneManager.playerCamera.matrixWorldInverse,
      );
      this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    });
  }
}
