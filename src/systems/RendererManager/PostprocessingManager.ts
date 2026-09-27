import { ColorManagement, NoToneMapping } from "three";
import { RenderPipeline, WebGPURenderer, type Node } from "three/webgpu";
import type { renderOutput } from "three/tsl";
import type { DebugFolder, DebugManager } from "../DebugManager";
import type { EventsManager } from "../EventsManager";
import type { SceneManager } from "../SceneManager";
import { ShadowPass } from "../ShadowManager/ShadowPass";
import { DualKawaseBloomPass } from "./DualKawaseBloomPass";
import { PostChain } from "./PostChain";
import { ScenePass } from "./ScenePass";
import { TexturePass } from "./TexturePass";
import { ToneMappingPass } from "./ToneMappingPass";
import { WaterPass } from "./WaterPass";

const BLOOM_OPTIONS = {
  strength: 0.8,
  threshold: 1,
  smoothWidth: 0.04,
  spread: 2,
};

export class PostprocessingManager extends RenderPipeline {
  private scenePass: ScenePass;
  private shadowPass: ShadowPass;
  private waterPass: WaterPass;
  private hdrPass: TexturePass;
  private bloomPass: DualKawaseBloomPass;
  private toneMappingPass: ToneMappingPass;
  private chain: PostChain<ReturnType<typeof renderOutput>>;
  private saturationTarget = 1;
  private saturationLerpSpeed = 14;
  private sceneManager: SceneManager;
  private eventsManager: EventsManager;
  private debugManager: DebugManager;
  private debugFolder: DebugFolder;
  private debugView = {
    target: "Scene",
  };
  private debugOutputs: Record<string, ReturnType<typeof renderOutput>>;

  constructor(
    renderer: WebGPURenderer,
    sceneManager: SceneManager,
    eventsManager: EventsManager,
    debugManager: DebugManager,
  ) {
    super(renderer);
    renderer.toneMappingExposure = 2;
    this.outputColorTransform = false;
    this.sceneManager = sceneManager;
    this.eventsManager = eventsManager;
    this.debugManager = debugManager;

    this.debugFolder = this.debugManager.panel.addFolder({
      title: "⭐️ Postprocessing",
      expanded: false,
    });

    const camera = this.sceneManager.renderCamera;
    this.scenePass = new ScenePass(renderer, sceneManager.mainScene, camera);
    this.shadowPass = new ShadowPass(renderer, this.scenePass, camera);
    this.waterPass = new WaterPass(renderer, sceneManager.waterScene, camera);
    this.hdrPass = new TexturePass(renderer, "Scene HDR");
    this.bloomPass = new DualKawaseBloomPass(renderer, BLOOM_OPTIONS);
    this.toneMappingPass = new ToneMappingPass();

    this.chain = PostChain.from(this.scenePass)
      .pipe(this.shadowPass)
      .pipe(this.waterPass)
      .pipe(this.hdrPass)
      .pipe(this.bloomPass)
      .pipe(this.toneMappingPass);

    this.debugOutputs = {
      Scene: this.chain.output,
      ...this.shadowPass.createDebugOutputs(),
    };
    this.addBindings();
    this.selectDebugView();

    this.eventsManager.on("engine-camera-change", this.onCameraChange);
    this.eventsManager.on("engine-slowmo-change", this.onSlowmoChange);
    this.eventsManager.on("engine-render-update", this.onEngineUpdate);
  }

  private onCameraChange = () => {
    const camera = this.sceneManager.renderCamera;
    this.scenePass.setCamera(camera);
    this.shadowPass.setCamera(camera);
    this.waterPass.setCamera(camera);
  };

  private onSlowmoChange = (isEnabled: boolean) => {
    this.saturationTarget = isEnabled ? 0 : 1;
  };

  private onEngineUpdate = ({ delta }: { delta: number }) => {
    const { saturation } = this.toneMappingPass;
    if (saturation.value === this.saturationTarget) return;
    const t = 1 - Math.exp(-this.saturationLerpSpeed * delta);
    saturation.value += (this.saturationTarget - saturation.value) * t;
  };

  private addBindings() {
    this.bloomPass.addBindings(this.debugFolder);
    this.debugFolder.addBinding(this.renderer, "toneMappingExposure", {
      label: "Exposure",
      min: 0,
      max: 10,
      step: 0.01,
    });
    this.shadowPass.addBindings(this.debugFolder);
    const viewOptions: Record<string, string> = {};
    for (const view of Object.keys(this.debugOutputs)) viewOptions[view] = view;
    this.debugFolder
      .addBinding(this.debugView, "target", {
        label: "View",
        options: viewOptions,
      })
      .on("change", this.selectDebugView);
  }

  private selectDebugView = () => {
    this.outputNode =
      this.debugOutputs[this.debugView.target] ?? this.debugOutputs.Scene;
    this.needsUpdate = true;
  };

  sampleMainSceneColor(uv: Node<"vec2">) {
    return this.shadowPass.sampleShadowedColor(uv);
  }

  get mainSceneDepthNode() {
    return this.scenePass.depth;
  }

  render() {
    const toneMapping = this.renderer.toneMapping;
    const outputColorSpace = this.renderer.outputColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.outputColorSpace = ColorManagement.workingColorSpace;
    try {
      this.chain.render();
    } finally {
      this.renderer.toneMapping = toneMapping;
      this.renderer.outputColorSpace = outputColorSpace;
    }
    super.render();
  }
}
