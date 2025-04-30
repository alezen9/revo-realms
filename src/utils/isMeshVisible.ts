import { Frustum, Matrix4, Mesh } from "three";
import { eventsManager } from "../systems/EventsManager";
import { sceneManager } from "../systems/SceneManager";

const frustum = new Frustum();
const projScreenMatrix = new Matrix4();

eventsManager.on("update-throttle-16x", () => {
  projScreenMatrix.multiplyMatrices(
    sceneManager.renderCamera.projectionMatrix,
    sceneManager.renderCamera.matrixWorldInverse,
  );
  frustum.setFromProjectionMatrix(projScreenMatrix);
});

export const isMeshVisible = (obj: Mesh) => {
  if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere();
  return frustum.intersectsObject(obj);
};
