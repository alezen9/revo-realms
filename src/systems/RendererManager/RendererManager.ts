import { type ComputeNode, WebGPURenderer } from "three/webgpu";
import { PostprocessingManager } from "./PostprocessingManager";
import { type DebugManager } from "../DebugManager";
import { type EventsManager } from "../EventsManager";
import type { SceneManager } from "../SceneManager";
import { ComputeTask } from "./ComputeTask";

type CreateComputeTaskOptions = {
  label: string;
  init?: ComputeNode | ComputeNode[];
  update: ComputeNode | ComputeNode[];
};

const RESOLUTION_SCALE = 0.85;

export class RendererManager {
  renderer: WebGPURenderer;
  canvas: HTMLCanvasElement;
  private sceneManager: SceneManager;
  private debugManager: DebugManager;
  private eventsManager: EventsManager;
  private postprocessingManager!: PostprocessingManager;

  constructor(
    sceneManager: SceneManager,
    debugManager: DebugManager,
    eventsManager: EventsManager,
    isDebugEnabled: boolean,
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
    this.debugManager.setVisibility(isDebugEnabled);

    this.eventsManager.on("engine-render-target-resize", (sizes) => {
      renderer.setSize(sizes.width, sizes.height);
      renderer.setPixelRatio(Math.max(sizes.dpr * RESOLUTION_SCALE, 1));
    });
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
