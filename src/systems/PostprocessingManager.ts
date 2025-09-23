import { PostProcessing, WebGPURenderer } from "three/webgpu";
import { pass, renderOutput } from "three/tsl";
import { sceneManager } from "./SceneManager";
import { eventsManager } from "./EventsManager";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { debugManager } from "./DebugManager";

export default class PostprocessingManager extends PostProcessing {
  private scenePass: ReturnType<typeof pass>;
  private debugFolder = debugManager.panel.addFolder({
    title: "⭐️ Postprocessing",
    expanded: false,
  });

  constructor(renderer: WebGPURenderer) {
    super(renderer);
    this.scenePass = pass(sceneManager.scene, sceneManager.renderCamera);

    const passes = this.makeGraph();
    this.outputNode = passes;

    eventsManager.on("camera-changed", () => {
      this.scenePass.camera = sceneManager.renderCamera;
      this.scenePass.needsUpdate = true;
    });
  }

  private makeGraph() {
    this.outputColorTransform = false;
    const colorHDR = this.scenePass.getTextureNode();

    const bloomPass = bloom(colorHDR, 0.25, 0.15, 1);
    bloomPass.smoothWidth.value = 0.04;
    // @ts-expect-error I know its private but looks good enough and reduces workload
    bloomPass._nMips = 2;

    this.debugFolder.addBinding(bloomPass.strength, "value", {
      label: "Bloom strength",
    });
    this.debugFolder.addBinding(bloomPass.threshold, "value", {
      label: "Bloom threshold",
    });

    const withBloomHDR = colorHDR.add(bloomPass);

    const toneMappedRender = renderOutput(withBloomHDR);

    return toneMappedRender;
  }
}
