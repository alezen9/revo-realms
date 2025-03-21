import { PostProcessing } from "three/webgpu";
import { Fn, pass } from "three/tsl";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { rendererManager } from "./RendererManager";
import { sceneManager } from "./SceneManager";

export default class PostprocessingManager {
  composer: PostProcessing;

  constructor() {
    this.composer = new PostProcessing(rendererManager.renderer);
    this.composer.outputNode = this.getPasses();
  }

  private getPasses = Fn(() => {
    const scenePass = pass(sceneManager.scene, sceneManager.renderCamera);
    const sceneColor = scenePass.getTextureNode();
    const bloomPass = bloom(sceneColor, 0.25, 0.1, 0.5);
    return bloomPass.add(scenePass);
  });
}
