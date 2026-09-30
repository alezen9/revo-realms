import { ColorManagement, NoToneMapping } from "three";
import { RenderPipeline, WebGPURenderer, type Node } from "three/webgpu";
import type { renderOutput } from "three/tsl";
import type {
  DebugBinding,
  DebugFolder,
  DebugPanel,
} from "../debug/DebugPanel";
import type { EventBus } from "../events/EventBus";
import type { Stage } from "../scene/Stage";
import { VSMPass, type VSMDependencies } from "../vsm/VSMPass";
import { DualKawaseBloomPass } from "./passes/DualKawaseBloomPass";
import { PostChain } from "./PostChain";
import { ScenePass } from "./passes/ScenePass";
import { TexturePass } from "./passes/TexturePass";
import { ACESToneMappingPass } from "./passes/ACESToneMappingPass";
import { WaterPass } from "./passes/WaterPass";

const BLOOM_OPTIONS = {
  strength: 0.8,
  threshold: 1,
  smoothWidth: 0.04,
  spread: 2,
};

export class FramePipeline extends RenderPipeline {
  private scenePass: ScenePass;
  readonly vsmPass: VSMPass;
  private waterPass: WaterPass;
  private hdrPass: TexturePass;
  private dualKawaseBloomPass: DualKawaseBloomPass;
  private acesToneMappingPass: ACESToneMappingPass;
  private chain: PostChain<ReturnType<typeof renderOutput>>;
  private saturationTarget = 1;
  private saturationLerpSpeed = 14;
  private stage: Stage;
  private eventBus: EventBus;
  private debugPanel: DebugPanel;
  private debugFolder: DebugFolder;
  private debugView = {
    target: "Scene",
  };
  private debugOutputs: Record<string, ReturnType<typeof renderOutput>>;
  private debugLegends: Record<string, string>;
  private debugLegend = { text: "" };
  private debugLegendBinding: DebugBinding<string>;

  constructor(
    renderer: WebGPURenderer,
    stage: Stage,
    eventBus: EventBus,
    debugPanel: DebugPanel,
    vsmDependencies: VSMDependencies,
  ) {
    super(renderer);
    renderer.toneMappingExposure = 2;
    this.outputColorTransform = false;
    this.stage = stage;
    this.eventBus = eventBus;
    this.debugPanel = debugPanel;

    this.debugFolder = this.debugPanel.panel.addFolder({
      title: "⭐️ Postprocessing",
      expanded: false,
    });

    const camera = this.stage.renderCamera;
    this.scenePass = new ScenePass(renderer, stage.mainScene, camera);
    this.vsmPass = new VSMPass(
      renderer,
      this.scenePass,
      camera,
      vsmDependencies,
    );
    this.waterPass = new WaterPass(renderer, stage.waterScene, camera);
    this.hdrPass = new TexturePass(renderer, "Scene HDR");
    this.dualKawaseBloomPass = new DualKawaseBloomPass(renderer, BLOOM_OPTIONS);
    this.acesToneMappingPass = new ACESToneMappingPass();

    this.chain = PostChain.from(this.scenePass)
      .pipe(this.vsmPass)
      .pipe(this.waterPass)
      .pipe(this.hdrPass)
      .pipe(this.dualKawaseBloomPass)
      .pipe(this.acesToneMappingPass);

    this.debugOutputs = {
      Scene: this.chain.output,
      ...this.vsmPass.createDebugOutputs(),
    };
    this.debugLegends = this.vsmPass.createDebugLegends();
    this.debugLegendBinding = this.addBindings();
    this.selectDebugView();

    this.eventBus.on("engine-camera-change", this.onCameraChange);
    this.eventBus.on("engine-slowmo-change", this.onSlowmoChange);
    this.eventBus.on("engine-render-update", this.onEngineUpdate);
  }

  private onCameraChange = () => {
    const camera = this.stage.renderCamera;
    this.scenePass.setCamera(camera);
    this.vsmPass.setCamera(camera);
    this.waterPass.setCamera(camera);
  };

  private onSlowmoChange = (isEnabled: boolean) => {
    this.saturationTarget = 1;
    if (isEnabled) this.saturationTarget = 0;
  };

  private onEngineUpdate = ({ delta }: { delta: number }) => {
    const { saturation } = this.acesToneMappingPass;
    if (saturation.value === this.saturationTarget) return;
    const t = 1 - Math.exp(-this.saturationLerpSpeed * delta);
    saturation.value += (this.saturationTarget - saturation.value) * t;
  };

  private addBindings() {
    this.dualKawaseBloomPass.addBindings(this.debugFolder);
    this.debugFolder.addBinding(this.renderer, "toneMappingExposure", {
      label: "Exposure",
      min: 0,
      max: 10,
      step: 0.01,
    });
    this.vsmPass.addBindings(this.debugFolder);
    const viewOptions: Record<string, string> = {};
    for (const view of Object.keys(this.debugOutputs)) viewOptions[view] = view;
    this.debugFolder
      .addBinding(this.debugView, "target", {
        label: "View",
        options: viewOptions,
      })
      .on("change", this.selectDebugView);
    let rows = 1;
    for (const legend of Object.values(this.debugLegends))
      rows = Math.max(rows, legend.split("\n").length);
    return this.debugFolder.addBinding(this.debugLegend, "text", {
      label: undefined,
      readonly: true,
      multiline: true,
      rows,
    });
  }

  private selectDebugView = () => {
    const { target } = this.debugView;
    this.outputNode = this.debugOutputs[target] ?? this.debugOutputs.Scene;
    this.needsUpdate = true;
    const legend = this.debugLegends[target];
    this.debugLegend.text = legend ?? "";
    this.debugLegendBinding.hidden = !legend;
  };

  async compileAsync() {
    await this.scenePass.compileAsync(this.renderer);
    await this.waterPass.compileAsync(this.renderer);
  }

  sampleMainSceneColor(uv: Node<"vec2">) {
    return this.vsmPass.sampleShadowedColor(uv);
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
