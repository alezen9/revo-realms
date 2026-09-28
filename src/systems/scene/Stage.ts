import { PerspectiveCamera, Scene, Matrix4, Vector3 } from "three";
import { uniform } from "three/tsl";
import { type EventBus } from "../events/EventBus";

export class Stage {
  mainScene = new Scene();
  waterScene = new Scene();
  playerCamera: PerspectiveCamera;
  renderCamera: PerspectiveCamera;
  readonly uFx = uniform(1);
  readonly uFy = uniform(1);
  readonly uCameraMatrix = uniform(new Matrix4());
  readonly uPlayerCameraPosition = uniform(new Vector3());

  constructor(eventBus: EventBus) {
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new PerspectiveCamera(45, aspect, 0.5, 150);
    camera.position.set(0, 5, 10);
    this.mainScene.add(camera);
    this.playerCamera = camera;
    this.renderCamera = camera;

    eventBus.on("engine-render-target-resize", (sizes) => {
      this.playerCamera.aspect = sizes.aspect;
      this.playerCamera.updateProjectionMatrix();
    });
  }

  get scenes() {
    return [this.mainScene, this.waterScene];
  }

  syncPlayerCameraUniforms() {
    const { projectionMatrix, matrixWorldInverse, position } =
      this.playerCamera;
    this.uPlayerCameraPosition.value.copy(position);
    this.uFx.value = projectionMatrix.elements[0];
    this.uFy.value = projectionMatrix.elements[5];
    this.uCameraMatrix.value.multiplyMatrices(
      projectionMatrix,
      matrixWorldInverse,
    );
  }
}
