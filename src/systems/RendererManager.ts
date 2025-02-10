import { ACESFilmicToneMapping, VSMShadowMap } from "three";
import { WebGPURenderer } from "three/webgpu";
import MonitoringManager from "./MonitoringManager";

export default class RendererManager {
  renderer: WebGPURenderer;
  canvas: HTMLCanvasElement;
  private monitoringManager: MonitoringManager;

  constructor() {
    const canvas = document.createElement("canvas");
    canvas.classList.add("revo-realms");
    document.body.appendChild(canvas);
    this.canvas = canvas;

    const renderer = new WebGPURenderer({
      canvas,
      antialias: true,
      trackTimestamp: true,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = VSMShadowMap;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    this.renderer = renderer;
    this.monitoringManager = new MonitoringManager();
  }

  async init() {
    await this.monitoringManager.stats.init(this.renderer);
  }

  async renderAsync(...args: Parameters<typeof this.renderer.renderAsync>) {
    await this.renderer.resolveTimestampsAsync("compute");
    // await this.postprocessingManager.composer.renderAsync();
    await this.renderer.renderAsync(...args);
    this.monitoringManager.updateCustomPanels(this.renderer);
    await this.renderer.resolveTimestampsAsync("render");
    this.monitoringManager.stats.update();
  }
}
