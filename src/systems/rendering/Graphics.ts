import { type ComputeNode, type Node, WebGPURenderer } from "three/webgpu";
import { FramePipeline } from "./FramePipeline";
import type { VSMDependencies } from "../vsm/VSMPass";
import { type DebugPanel } from "../debug/DebugPanel";
import { type EventBus } from "../events/EventBus";
import type { Stage } from "../scene/Stage";
import { ComputeTask } from "./ComputeTask";
import type { Sizes } from "../../Game";

type CreateComputeTaskOptions = {
  label: string;
  init?: ComputeNode | ComputeNode[];
  update: ComputeNode | ComputeNode[];
};

export const rendererConfig = {
  resolutionScale: 0.85,
};

export class Graphics {
  renderer: WebGPURenderer;
  canvas: HTMLCanvasElement;
  private stage: Stage;
  private debugPanel: DebugPanel;
  private eventBus: EventBus;
  private framePipeline!: FramePipeline;
  private sizes?: Sizes;

  constructor(stage: Stage, debugPanel: DebugPanel, eventBus: EventBus) {
    this.stage = stage;
    this.debugPanel = debugPanel;
    this.eventBus = eventBus;
    const canvas = document.createElement("canvas");
    canvas.classList.add("revo-realms");
    document.body.appendChild(canvas);
    this.canvas = canvas;

    const renderer = new WebGPURenderer({
      canvas,
      // the scene pass carries the MSAA
      antialias: false,
      trackTimestamp: false,
      powerPreference: "high-performance",
      stencil: false,
      depth: false,
    });
    renderer.setClearColor(0x000000, 0);

    this.renderer = renderer;

    this.eventBus.on("engine-render-target-resize", (sizes) => {
      this.sizes = sizes;
      this.applyResolution();
    });
  }

  applyResolution() {
    if (!this.sizes) return;
    const { width, height, dpr } = this.sizes;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(dpr * rendererConfig.resolutionScale);
  }

  async init() {
    await this.renderer.init();
  }

  initFramePipeline(vsmDependencies: VSMDependencies) {
    this.framePipeline = new FramePipeline(
      this.renderer,
      this.stage,
      this.eventBus,
      this.debugPanel,
      vsmDependencies,
    );
  }

  sampleMainSceneColor(uv: Node<"vec2">) {
    return this.framePipeline.sampleMainSceneColor(uv);
  }

  get mainSceneDepthNode() {
    return this.framePipeline.mainSceneDepthNode;
  }

  get vsmPass() {
    return this.framePipeline.vsmPass;
  }

  compileScenesOnceAsync() {
    return this.framePipeline.compileAsync();
  }

  createComputeTask(options: CreateComputeTaskOptions) {
    return new ComputeTask({
      renderer: this.renderer,
      ...options,
    });
  }

  render() {
    this.framePipeline.render();
  }
}
