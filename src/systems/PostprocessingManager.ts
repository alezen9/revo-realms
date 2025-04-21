import { PostProcessing, WebGPURenderer } from "three/webgpu";
import { emissive, Fn, mrt, output, pass } from "three/tsl";
import { sceneManager } from "./SceneManager";
import { bloom as originalBloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { bloom } from "../bloom";

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

    const bloomPass = originalBloom(emissiveColor);

    return outputColor.add(bloomPass);
  });
}
