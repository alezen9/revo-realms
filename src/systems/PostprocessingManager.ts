import { PostProcessing } from "three/webgpu";
import { emissive, mrt, output, pass } from "three/tsl";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import RendererManager from "./RendererManager";
import SceneManager from "./SceneManager";

export default class PostprocessingManager {
  composer: PostProcessing;

  constructor(rendererManager: RendererManager, sceneManager: SceneManager) {
    this.composer = new PostProcessing(rendererManager.renderer);

    const scenePass = pass(sceneManager.scene, sceneManager.renderCamera);

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

    this.composer.outputNode = outputNode;
    this.composer.needsUpdate = true;
  }
}
