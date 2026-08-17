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
  private readonly IS_POSTPROCESSING_ENABLED = true;

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
      // only the fallback path draws depth tested geometry straight to the canvas
      depth: !this.IS_POSTPROCESSING_ENABLED,
    });
    renderer.setClearColor(0x000000, 1);

    renderer.toneMappingExposure = 1.5;
    this.renderer = renderer;
    this.debugManager.setVisibility(isDebugEnabled);

    this.eventsManager.on("engine-render-target-resize", (sizes) => {
      const scaled = this.IS_POSTPROCESSING_ENABLED
        ? sizes.dpr * RESOLUTION_SCALE
        : sizes.dpr;
      renderer.setSize(sizes.width, sizes.height);
      renderer.setPixelRatio(Math.max(scaled, 1));
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

  private renderScene() {
    if (this.IS_POSTPROCESSING_ENABLED) this.postprocessingManager.render();
    else
      this.renderer.render(
        this.sceneManager.scene,
        this.sceneManager.renderCamera,
      );
  }

  async compileSceneOnceAsync() {
    return this.renderer.compileAsync(
      this.sceneManager.scene,
      this.sceneManager.renderCamera,
    );
  }

  async renderSceneOnceAsync() {
    this.renderScene();
  }

  createComputeTask(options: CreateComputeTaskOptions) {
    return new ComputeTask({
      renderer: this.renderer,
      ...options,
    });
  }

  render() {
    this.renderScene();
  }
}
