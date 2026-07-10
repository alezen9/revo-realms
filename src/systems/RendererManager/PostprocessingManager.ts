import { ACESFilmicToneMapping, NoToneMapping } from "three";
import { RenderPipeline, WebGPURenderer } from "three/webgpu";
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
import type { DebugManager } from "../DebugManager";
import type { EventsManager } from "../EventsManager";
import type { SceneManager } from "../SceneManager";
import type { FolderApi } from "tweakpane";

const LUMINANCE_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);

export class PostprocessingManager extends RenderPipeline {
  private scenePass: ReturnType<typeof pass>;
  private uSaturation = uniform(1);
  private saturationTarget = 1;
  private saturationLerpSpeed = 14;
  private sceneManager: SceneManager;
  private eventsManager: EventsManager;
  private debugManager: DebugManager;
  private debugFolder: FolderApi;

  constructor(
    renderer: WebGPURenderer,
    sceneManager: SceneManager,
    eventsManager: EventsManager,
    debugManager: DebugManager,
  ) {
    super(renderer);
    renderer.toneMappingExposure = 2;
    this.sceneManager = sceneManager;
    this.eventsManager = eventsManager;
    this.debugManager = debugManager;

    this.debugFolder = this.debugManager.panel.addFolder({
      title: "⭐️ Postprocessing",
      expanded: false,
    });
    this.scenePass = pass(
      this.sceneManager.scene,
      this.sceneManager.renderCamera,
    );

    const passes = this.makeGraph();
    this.outputNode = passes;

    this.eventsManager.on("engine-camera-change", () => {
      this.scenePass.camera = this.sceneManager.renderCamera;
      this.scenePass.needsUpdate = true;
    });

    this.eventsManager.on("engine-slowmo-change", (enabled: boolean) => {
      this.saturationTarget = enabled ? 0 : 1;
    });

    this.eventsManager.on("engine-render-update", ({ delta }) => {
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
    this.debugFolder.addBinding(this.renderer, "toneMappingExposure", {
      label: "Exposure",
      min: 0,
      max: 2,
      step: 0.01,
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
