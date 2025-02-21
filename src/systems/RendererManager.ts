import { ACESFilmicToneMapping, VSMShadowMap } from "three";
import { WebGPURenderer } from "three/webgpu";
import MonitoringManager from "./MonitoringManager";
import PostprocessingManager from "./PostprocessingManager";
import SceneManager from "./SceneManager";
import { debugManager } from "./DebugManager";

export default class RendererManager {
  renderer: WebGPURenderer;
  canvas: HTMLCanvasElement;
  private monitoringManager: MonitoringManager;
  private postprocessingManager!: PostprocessingManager;
  private readonly POSTPROCESSING_ENABLED = false;
  private readonly MONITORING_ENABLED = false;
  private readonly DEBUGGING_ENABLED = true;

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
    renderer.shadowMap.type = VSMShadowMap;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    this.renderer = renderer;
    this.monitoringManager = new MonitoringManager(this.MONITORING_ENABLED);
    debugManager.setVisibility(this.DEBUGGING_ENABLED);
  }

  async init(sceneManager: SceneManager) {
    this.postprocessingManager = new PostprocessingManager(this, sceneManager);
    if (this.MONITORING_ENABLED)
      await this.monitoringManager.stats.init(this.renderer);
  }

  async renderAsync(...args: Parameters<typeof this.renderer.renderAsync>) {
    if (this.MONITORING_ENABLED)
      await this.renderer.resolveTimestampsAsync("compute");
    if (this.POSTPROCESSING_ENABLED)
      await this.postprocessingManager.composer.renderAsync();
    else await this.renderer.renderAsync(...args);
    if (this.MONITORING_ENABLED) {
      this.monitoringManager.updateCustomPanels(this.renderer);
      await this.renderer.resolveTimestampsAsync("render");
      this.monitoringManager.stats.update();
    }
  }
}
