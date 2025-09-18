import { PostProcessing, WebGPURenderer } from "three/webgpu";
import { pass, renderOutput } from "three/tsl";
import { sceneManager } from "./SceneManager";
import { eventsManager } from "./EventsManager";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
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

    const bloomPass = bloom(colorHDR, 0.5, 0.15, 0.6);
    bloomPass.smoothWidth.value = 0.04;

    this.debugFolder.addBinding(bloomPass.strength, "value", {
      label: "Bloom strength",
    });

    const withBloomHDR = colorHDR.add(bloomPass);

    const withSmaaHDR = smaa(withBloomHDR);

    return renderOutput(withSmaaHDR);
  }

  // private getPasses() {
  //   // antialias
  //   const smaaPass = smaa(this.scenePass);
  //   // const ssaa = ssaaPass(sceneManager.scene, sceneManager.renderCamera); // good looking but too expensive
  //   // ssaa.sampleLevel = 3;

  //   // dof
  //   // const scenePassColor = smaaPass.getTextureNode();
  //   // const scenePassViewZ = this.scenePass.getViewZNode();

  //   // const dofPass = dof(
  //   //   scenePassColor,
  //   //   scenePassViewZ,
  //   //   20,
  //   //   float(7.5).mul(0.00001),
  //   //   0.01,
  //   // );

  //   return smaaPass;
  // }
}
