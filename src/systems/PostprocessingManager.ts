import { PostProcessing, WebGPURenderer } from "three/webgpu";
import { emissive, Fn, mrt, output, pass } from "three/tsl";
import { sceneManager } from "./SceneManager";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";

export default class PostprocessingManager extends PostProcessing {
  constructor(renderer: WebGPURenderer) {
    super(renderer);
    this.outputNode = this.getPasses();
  }

  private getPasses = Fn(() => {
    const scenePass = pass(sceneManager.scene, sceneManager.renderCamera);
    scenePass.setMRT(
      mrt({
        output,
        emissive,
      }),
    );

    const outputColor = scenePass.getTextureNode();
    const emissiveColor = scenePass.getTextureNode("emissive");

    const bloomPass = bloom(emissiveColor);

    return outputColor.add(bloomPass);
  });
}
