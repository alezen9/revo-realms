import { type ComputeNode, WebGPURenderer } from "three/webgpu";
import { PostprocessingManager } from "./PostprocessingManager";
import { type DebugManager } from "../DebugManager";
import { type EventsManager } from "../EventsManager";
import type { SceneManager } from "../SceneManager";
import { ComputeTask } from "./ComputeTask";
import type { Sizes } from "../../Game";
import { TOOLING_FLAGS } from "@systems-tooling-runtime";

type CreateComputeTaskOptions = {
  label: string;
  init?: ComputeNode | ComputeNode[];
  update: ComputeNode | ComputeNode[];
};

export const rendererConfig = {
  resolutionScale: 0.85,
};

export class RendererManager {
  renderer: WebGPURenderer;
  canvas: HTMLCanvasElement;
  private sceneManager: SceneManager;
  private debugManager: DebugManager;
  private eventsManager: EventsManager;
  private postprocessingManager!: PostprocessingManager;
  private sizes?: Sizes;

  constructor(
    sceneManager: SceneManager,
    debugManager: DebugManager,
    eventsManager: EventsManager,
  ) {
    this.sceneManager = sceneManager;
    this.debugManager = debugManager;
    this.eventsManager = eventsManager;
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

    renderer.toneMappingExposure = 1.5;
    this.renderer = renderer;
    this.debugManager.setVisibility(TOOLING_FLAGS.debug);

    this.eventsManager.on("engine-render-target-resize", (sizes) => {
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
    this.eventsManager.emit("engine-renderer-ready");
    this.sceneManager.init(this.canvas, this.debugManager);
  }

  initPostprocessing() {
    this.postprocessingManager = new PostprocessingManager(
      this.renderer,
      this.sceneManager,
      this.eventsManager,
      this.debugManager,
    );
  }

  get mainSceneColorNode() {
    return this.postprocessingManager.mainSceneColorNode;
  }

  get mainSceneDepthNode() {
    return this.postprocessingManager.mainSceneDepthNode;
  }

  async compileScenesOnceAsync() {
    const { scenes, renderCamera } = this.sceneManager;
    for (const scene of scenes)
      await this.renderer.compileAsync(scene, renderCamera);
  }

  createComputeTask(options: CreateComputeTaskOptions) {
    return new ComputeTask({
      renderer: this.renderer,
      ...options,
    });
  }

  render() {
    this.postprocessingManager.render();
  }
}
