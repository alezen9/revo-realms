import { Frustum, Matrix4, Mesh } from "three";
import type { EventBus } from "../events/EventBus";
import type { Stage } from "../scene/Stage";

export class FrustumCulling {
  private frustum = new Frustum();
  private viewProjectionMatrix = new Matrix4();

  constructor(eventBus: EventBus, stage: Stage) {
    eventBus.on("engine-render-update-throttle-16x", () => {
      const { playerCamera } = stage;
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
