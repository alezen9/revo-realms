import { Matrix4, type Camera } from "three";
import type { Node } from "three/webgpu";
import {
  float,
  getViewPosition,
  mix,
  screenUV,
  uniform,
  vec4,
} from "three/tsl";
import { lightingManager } from "..";
import type { ScenePass } from "./ScenePass";

export class FogPass {
  private scene: ScenePass;
  private projectionMatrixInverse = uniform(new Matrix4());
  private cameraWorldMatrix = uniform(new Matrix4());

  constructor(scene: ScenePass, camera: Camera) {
    this.scene = scene;
    this.setCamera(camera);
  }

  setCamera(camera: Camera) {
    this.projectionMatrixInverse.value = camera.projectionMatrixInverse;
    this.cameraWorldMatrix.value = camera.matrixWorld;
  }

  apply(sceneColor: Node<"vec4">) {
    const depth = this.scene.depth.sample(screenUV).r;
    const viewPosition = getViewPosition(
      screenUV,
      depth,
      this.projectionMatrixInverse,
    );
    const worldPosition = this.cameraWorldMatrix.mul(vec4(viewPosition, 1)).xyz;
    const cameraPosition = this.cameraWorldMatrix.mul(vec4(0, 0, 0, 1)).xyz;
    const isBackground = depth.greaterThanEqual(1);
    const fogVisibility = isBackground.select(
      float(1),
      lightingManager.getFogVisibility(worldPosition, cameraPosition),
    );
    const fogColor = lightingManager.getFogColor(worldPosition, cameraPosition);
    return vec4(mix(fogColor, sceneColor.rgb, fogVisibility), sceneColor.a);
  }
}
