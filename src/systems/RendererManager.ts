import { ACESFilmicToneMapping, PCFShadowMap } from "three";
import { WebGPURenderer } from "three/webgpu";
import MonitoringManager from "./MonitoringManager";
import PostprocessingManager from "./PostprocessingManager";
import { debugManager } from "./DebugManager";
import { sceneManager } from "./SceneManager";
import { eventsManager } from "./EventsManager";

const ENABLE_MONITORING = false;
const ENABLE_DEBUGGING = false;

class RendererManager {
  renderer: WebGPURenderer;
  canvas: HTMLCanvasElement;
  private prevFrame: Promise<any> | null = null;
  private monitoringManager: MonitoringManager;
  private postprocessingManager!: PostprocessingManager;
  private readonly IS_POSTPROCESSING_ENABLED = true;
  private readonly IS_MONITORING_ENABLED =
    import.meta.env.DEV && ENABLE_MONITORING;
  private readonly IS_DEBUGGING_ENABLED =
    import.meta.env.DEV && ENABLE_DEBUGGING;

  constructor() {
    const canvas = document.createElement("canvas");
    canvas.classList.add("revo-realms");
    document.body.appendChild(canvas);
    this.canvas = canvas;

    const renderer = new WebGPURenderer({
      canvas,
      antialias: true,
      trackTimestamp: this.IS_MONITORING_ENABLED,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 1);

    renderer.toneMappingExposure = 1.5;
    this.renderer = renderer;
    this.monitoringManager = new MonitoringManager(this.IS_MONITORING_ENABLED);
    debugManager.setVisibility(this.IS_DEBUGGING_ENABLED);

    eventsManager.on("resize", (sizes) => {
      // reduce dpr to 85% if postprocessing enabled, min dpr = 1
      const dpr = Math.max(
        this.IS_POSTPROCESSING_ENABLED ? sizes.dpr * 0.75 : sizes.dpr,
        1,
      );
      renderer.setSize(sizes.width, sizes.height);
      renderer.setPixelRatio(dpr);
    });
  }

  async init() {
    sceneManager.init();
    this.postprocessingManager = new PostprocessingManager(this.renderer);
    if (this.IS_MONITORING_ENABLED)
      await this.monitoringManager.stats.init(this.renderer);
  }

  private async renderSceneAsync() {
    if (this.IS_POSTPROCESSING_ENABLED)
      return this.postprocessingManager.renderAsync();
    else
      return this.renderer.renderAsync(
        sceneManager.scene,
        sceneManager.renderCamera,
      );
  }

  private renderWithMonitoring() {
    const p = Promise.all([
      this.renderer.resolveTimestampsAsync("compute"),
      this.renderSceneAsync(),
      this.renderer.resolveTimestampsAsync("render"),
    ]);

    // Consume last frame’s results now (they should be ready)
    this.prevFrame
      ?.then(() => {
        this.monitoringManager.updateCustomPanels();
        this.monitoringManager.stats.update();
      })
      .catch((err) => {
        console.error("[renderWithMonitoring] previous frame error:", err);
      });

    // Set current as previous for next loop
    this.prevFrame = p;
  }

  async renderAsync() {
    if (this.IS_MONITORING_ENABLED) this.renderWithMonitoring();
    else this.renderSceneAsync();
  }
}

export const rendererManager = new RendererManager();
