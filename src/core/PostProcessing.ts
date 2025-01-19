import { PostProcessing as WebGpuPostProcessing } from "three/webgpu";
import { State } from "./Engine";
import { emissive, mrt, output, pass } from "three/tsl";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";

export default class PostProcessing {
  private postprocessing: WebGpuPostProcessing;

  constructor(state: Pick<State, "renderer" | "scene" | "camera">) {
    const { renderer, scene, camera } = state;
    this.postprocessing = new WebGpuPostProcessing(renderer);

    const scenePass = pass(scene, camera);

    // Setup Multiple Render Targets (MRT)
    scenePass.setMRT(
      mrt({
        output,
        // normal: transformedNormalView,
        // metalness: metalness,
        // depth: depth,
        emissive,
      }),
    );

    const scenePassColor = scenePass.getTextureNode("output");
    const scenePassEmissive = scenePass.getTextureNode("emissive");
    const bloomPass = bloom(scenePassEmissive, 0.25, 0.1, 0.5);
    const outputNode = scenePassColor.add(bloomPass);

    this.postprocessing.outputNode = outputNode;
    this.postprocessing.needsUpdate = true;
  }

  get renderer() {
    return this.postprocessing.renderer;
  }

  renderAsync() {
    return this.postprocessing.renderAsync();
  }
}
