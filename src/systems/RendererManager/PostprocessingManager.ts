import { ACESFilmicToneMapping, NoToneMapping } from "three";
import { PostProcessing, WebGPURenderer } from "three/webgpu";
import {
  mix,
  pass,
  renderOutput,
  toneMapping,
  toneMappingExposure,
  uniform,
  vec3,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { debugManager, sceneManager, eventsManager } from "..";

const LUMINANCE_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);

export class PostprocessingManager extends PostProcessing {
  private scenePass: ReturnType<typeof pass>;
  private uSaturation = uniform(1.0);
  private saturationTarget = 1.0;
  private saturationLerpSpeed = 14;
  private debugFolder = debugManager.panel.addFolder({
    title: "⭐️ Postprocessing",
    expanded: false,
  });

  constructor(renderer: WebGPURenderer) {
    super(renderer);
    this.scenePass = pass(sceneManager.scene, sceneManager.renderCamera);

    const passes = this.makeGraph();
    this.outputNode = passes;

    eventsManager.on("engine-camera-change", () => {
      this.scenePass.camera = sceneManager.renderCamera;
      this.scenePass.needsUpdate = true;
    });

    eventsManager.on("radial-menu-visibility", (visible: boolean) => {
      this.saturationTarget = visible ? 0.0 : 1.0;
    });

    eventsManager.on("engine-update", ({ delta }) => {
      if (this.uSaturation.value === this.saturationTarget) return;
      const t = 1 - Math.exp(-this.saturationLerpSpeed * delta);
      this.uSaturation.value +=
        (this.saturationTarget - this.uSaturation.value) * t;
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

    const toneMapped = toneMapping(
      ACESFilmicToneMapping,
      toneMappingExposure,
      withBloomHDR,
    ).rgb;
    const luminance = toneMapped.dot(LUMINANCE_WEIGHTS);
    const desaturated = mix(vec3(luminance), toneMapped, this.uSaturation);

    return renderOutput(desaturated, NoToneMapping);
  }
}
