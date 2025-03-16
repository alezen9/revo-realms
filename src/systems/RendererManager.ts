import { ACESFilmicToneMapping } from "three";
import { WebGPURenderer } from "three/webgpu";
import MonitoringManager from "./MonitoringManager";
import PostprocessingManager from "./PostprocessingManager";
import { debugManager } from "./DebugManager";
import { sceneManager } from "./SceneManager";

class RendererManager {
  renderer: WebGPURenderer;
  canvas: HTMLCanvasElement;
  private monitoringManager: MonitoringManager;
  private postprocessingManager!: PostprocessingManager;
  private readonly POSTPROCESSING_ENABLED = false;
  private readonly MONITORING_ENABLED = import.meta.env.DEV;
  private readonly DEBUGGING_ENABLED = import.meta.env.DEV;

  constructor() {
    const canvas = document.createElement("canvas");
    canvas.classList.add("revo-realms");
    document.body.appendChild(canvas);
    this.canvas = canvas;

    const renderer = new WebGPURenderer({
      canvas,
      antialias: true,
      trackTimestamp: false,
    });
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    this.renderer = renderer;
    this.monitoringManager = new MonitoringManager(this.MONITORING_ENABLED);
    debugManager.setVisibility(this.DEBUGGING_ENABLED);
  }

  async init() {
    this.postprocessingManager = new PostprocessingManager();
    if (this.MONITORING_ENABLED)
      await this.monitoringManager.stats.init(this.renderer);
  }

  async renderAsync() {
    if (this.MONITORING_ENABLED)
      await this.renderer.resolveTimestampsAsync("compute");
    if (this.POSTPROCESSING_ENABLED)
      await this.postprocessingManager.composer.renderAsync();
    else
      await this.renderer.renderAsync(
        sceneManager.scene,
        sceneManager.renderCamera,
      );
    if (this.MONITORING_ENABLED) {
      this.monitoringManager.updateCustomPanels();
      await this.renderer.resolveTimestampsAsync("render");
      this.monitoringManager.stats.update();
    }
  }
}

export const rendererManager = new RendererManager();
