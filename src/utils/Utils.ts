import { eventsManager, sceneManager } from "../systems";
import { Frustum, Matrix4, Mesh } from "three";

const COMMON_REFRESH_RATES = [30, 60, 120, 144, 160, 165, 170, 180, 240];

const findClosest = (goal: number) =>
  COMMON_REFRESH_RATES.reduce((prev, curr) =>
    Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev,
  );

export class Utils {
  static frustum = new Frustum();
  static projScreenMatrix = new Matrix4();

  static getRefreshRate = async () => {
    return new Promise<number>((resolve) => {
      const dts: number[] = [];
      let last = performance.now(),
        start = last;
      function tick(t: number) {
        dts.push(t - last);
        last = t;
        if (t - start < 1000) requestAnimationFrame(tick);
        else {
          dts.sort((a, b) => a - b);
          const median = dts[Math.floor(dts.length / 2)] || 16.667;
          const hz = 1000 / median;
          const refreshRate = findClosest(hz);
          resolve(refreshRate);
        }
      }
      requestAnimationFrame(tick);
    });
  };

  static isMeshVisible = (obj: Mesh) => {
    if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere();
    return this.frustum.intersectsObject(obj);
  };

  /**
   * Call only once
   */
  static init() {
    eventsManager.on("engine-render-update-throttle-16x", () => {
      this.projScreenMatrix.multiplyMatrices(
        sceneManager.playerCamera.projectionMatrix,
        sceneManager.playerCamera.matrixWorldInverse,
      );
      this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    });
  }
}
