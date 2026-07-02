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

type ShadowMapWithTransmission = WebGPURenderer["shadowMap"] & {
  transmitted: boolean;
};

export class RendererManager {
  renderer: WebGPURenderer;
  canvas: HTMLCanvasElement;
  private sceneManager: SceneManager;
  private debugManager: DebugManager;
  private eventsManager: EventsManager;
  private monitoringManager?: MonitoringManagerLike;
  private postprocessingManager!: PostprocessingManager;
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
      trackTimestamp: false,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    (renderer.shadowMap as ShadowMapWithTransmission).transmitted = true;
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
    this.postprocessingManager = new PostprocessingManager(
      this.renderer,
      this.sceneManager,
      this.eventsManager,
      this.debugManager,
    );
    if (this.isMonitoringEnabled && this.monitoringManager) {
      this.monitoringManager.attach?.();
      await this.monitoringManager.stats.init(this.renderer);
    }
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

  private renderWithMonitoring() {
    const monitoringManager = this.monitoringManager;
    if (!monitoringManager) return;
    this.renderScene();
    monitoringManager.updateCustomPanels(this);
    monitoringManager.stats.update();
  }

  private renderWithoutMonitoring() {
    this.renderScene();
  }

  async renderAsync() {
    if (this.isMonitoringEnabled) this.renderWithMonitoring();
    else this.renderWithoutMonitoring();
  }
}
