import { Frustum, Matrix4, Mesh } from "three";
import type { EventsManager } from "./EventsManager";
import type { SceneManager } from "./SceneManager";

export class CullingManager {
  private frustum = new Frustum();
  private viewProjectionMatrix = new Matrix4();

  constructor(eventsManager: EventsManager, sceneManager: SceneManager) {
    eventsManager.on("engine-render-update-throttle-16x", () => {
      const { playerCamera } = sceneManager;
      this.viewProjectionMatrix.multiplyMatrices(
        playerCamera.projectionMatrix,
        playerCamera.matrixWorldInverse,
      );
      this.frustum.setFromProjectionMatrix(this.viewProjectionMatrix);
    });
  }

  isMeshVisible = (mesh: Mesh) => {
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    return this.frustum.intersectsObject(mesh);
  };
}
