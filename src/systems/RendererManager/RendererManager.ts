import { PCFShadowMap } from "three";
import { WebGPURenderer } from "three/webgpu";
import { PostprocessingManager } from "./PostprocessingManager";
import { type DebugManager } from "../DebugManager";
import { type EventsManager } from "../EventsManager";
import type { SceneManager } from "../SceneManager";

const ENABLE_DEBUGGING = true;
const IS_DEBUGGING_ENABLED = import.meta.env.DEV && ENABLE_DEBUGGING;

type MonitoringManagerLike = {
  attach?: () => void;
  stats: {
    init: (renderer: WebGPURenderer) => Promise<void>;
    update: () => void;
  };
  updateCustomPanels: (rendererManager: RendererManager) => void;
};

export class RendererManager {
  renderer: WebGPURenderer;
  canvas: HTMLCanvasElement;
  isWebGPU!: boolean;
  private sceneManager: SceneManager;
  private debugManager: DebugManager;
  private eventsManager: EventsManager;
  private prevFrame: Promise<any> | null = null;
  private monitoringManager?: MonitoringManagerLike;
  private postprocessingManager!: PostprocessingManager;
  private isRenderInFlight = false;
  private readonly isMonitoringEnabled: boolean;
  private readonly IS_POSTPROCESSING_ENABLED = true;

  constructor(
    sceneManager: SceneManager,
    debugManager: DebugManager,
    eventsManager: EventsManager,
    monitoringManager?: MonitoringManagerLike,
  ) {
    this.sceneManager = sceneManager;
    this.debugManager = debugManager;
    this.eventsManager = eventsManager;
    this.monitoringManager = monitoringManager;
    this.isMonitoringEnabled = !!monitoringManager;
    const canvas = document.createElement("canvas");
    canvas.classList.add("revo-realms");
    document.body.appendChild(canvas);
    this.canvas = canvas;

    const renderer = new WebGPURenderer({
      canvas,
      antialias: true,
      trackTimestamp: this.isMonitoringEnabled,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.setClearColor(0x000000, 1);

    renderer.toneMappingExposure = 1.5;
    this.renderer = renderer;
    this.debugManager.setVisibility(IS_DEBUGGING_ENABLED);

    this.eventsManager.on("engine-render-target-resize", (sizes) => {
      // reduce dpr to 85% if postprocessing enabled, min dpr = 1
      const dpr = Math.max(
        this.IS_POSTPROCESSING_ENABLED ? sizes.dpr * 0.85 : sizes.dpr,
        1,
      );
      renderer.setSize(sizes.width, sizes.height);
      renderer.setPixelRatio(dpr);
    });
  }

  async init() {
    await this.renderer.init();
    this.sceneManager.init(this.canvas, this.debugManager);
    this.isWebGPU = !!(await navigator.gpu?.requestAdapter());
    this.postprocessingManager = new PostprocessingManager(
      this.renderer,
      this.sceneManager,
      this.eventsManager,
      this.debugManager,
    );
    if (this.isMonitoringEnabled && this.monitoringManager) {
      this.monitoringManager.attach?.();
      this.renderer.info.autoReset = false;
      await this.monitoringManager.stats.init(this.renderer);
    }
  }

  private async renderSceneAsync() {
    if (this.IS_POSTPROCESSING_ENABLED)
      return this.postprocessingManager.renderAsync();
    else
      return this.renderer.renderAsync(
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
    return this.renderSceneAsync();
  }

  private renderWithMonitoring() {
    const monitoringManager = this.monitoringManager;
    if (!monitoringManager) return;
    // Consume last frame’s results now (they should be ready)
    this.prevFrame
      ?.then(() => {
        monitoringManager.updateCustomPanels(this);
        monitoringManager.stats.update();
        this.renderer.info.reset();
      })
      .catch((err) => {
        console.error("[renderWithMonitoring] previous frame error:", err);
      });

    // Set current as previous for next loop
    this.prevFrame = Promise.all([
      this.renderer.resolveTimestampsAsync("compute"),
      this.renderSceneAsync(),
      this.renderer.resolveTimestampsAsync("render"),
    ]);
  }

  private renderWithoutMonitoring() {
    if (this.isRenderInFlight) return;
    this.isRenderInFlight = true;
    this.renderSceneAsync()
      .catch((error) => {
        console.error("[RendererManager] renderAsync failed:", error);
      })
      .finally(() => {
        this.isRenderInFlight = false;
      });
  }

  async renderAsync() {
    if (this.isMonitoringEnabled) this.renderWithMonitoring();
    else this.renderWithoutMonitoring();
  }
}
