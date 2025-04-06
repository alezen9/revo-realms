import { ACESFilmicToneMapping, SRGBColorSpace, PCFShadowMap } from "three";
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
  private readonly IS_POSTPROCESSING_ENABLED = false;
  private readonly IS_MONITORING_ENABLED = import.meta.env.DEV;
  private readonly IS_DEBUGGING_ENABLED = import.meta.env.DEV;

  constructor() {
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
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(0x000000, 1);

    renderer.toneMappingExposure = 1.5;
    this.renderer = renderer;
    this.monitoringManager = new MonitoringManager(this.IS_MONITORING_ENABLED);
    debugManager.setVisibility(this.IS_DEBUGGING_ENABLED);
  }

  async init() {
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

  private async renderWithMonitoring() {
    await this.renderer.resolveTimestampsAsync("compute");
    await this.renderSceneAsync();
    this.monitoringManager.updateCustomPanels();
    await this.renderer.resolveTimestampsAsync("render");
    this.monitoringManager.stats.update();
  }

  async renderAsync() {
    if (this.IS_MONITORING_ENABLED) this.renderWithMonitoring();
    else this.renderSceneAsync();
  }
}

export const rendererManager = new RendererManager();
