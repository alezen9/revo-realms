import { PostProcessing, WebGPURenderer } from "three/webgpu";
import { emissive, mrt, output, pass } from "three/tsl";
import { sceneManager } from "./SceneManager";
import { smaa } from "three/examples/jsm/tsl/display/SMAANode.js";
import { eventsManager } from "./EventsManager";

export default class PostprocessingManager extends PostProcessing {
  private scenePass: ReturnType<typeof pass>;
  constructor(renderer: WebGPURenderer) {
    super(renderer);
    this.scenePass = pass(sceneManager.scene, sceneManager.renderCamera);
    this.scenePass.setMRT(
      mrt({
        output,
        emissive,
      }),
    );

    const passes = this.getPasses();
    this.outputNode = passes;

    eventsManager.on("camera-changed", () => {
      this.scenePass.camera = sceneManager.renderCamera;
      this.scenePass.needsUpdate = true;
    });
  }

  // IMPORTANT -> set this.outputColorTransform = false; when using this version
  // private makeGraph() {
  //   const colourLinear = this.scenePass.getTextureNode(); // MRT[0]
  //   const emissiveLinear = this.scenePass.getTextureNode("emissive");

  //   /* bloom in HDR / linear space */
  //   const colourPlusBloom = colourLinear.add(bloom(emissiveLinear));

  //   /* tone-map + sRGB so SMAA sees LDR */
  //   const ldrColour = renderOutput(colourPlusBloom);

  //   /* SMAA antialias on the final image */
  //   return smaa(ldrColour);
  // }

  private getPasses() {
    const smaaPass = smaa(this.scenePass);

    return smaaPass;
  }
}
