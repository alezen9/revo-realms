import { ACESFilmicToneMapping, VSMShadowMap } from "three";
import { WebGPURenderer } from "three/webgpu";
import MonitoringManager from "./MonitoringManager";

export default class RendererManager {
  renderer: WebGPURenderer;
  canvas: HTMLCanvasElement;
  device: GPUDevice;
  private monitoringManager: MonitoringManager;

  constructor(device: GPUDevice) {
    const canvas = document.createElement("canvas");
    canvas.classList.add("revo-realms");
    document.body.appendChild(canvas);
    this.canvas = canvas;

    this.device = device;

    const renderer = new WebGPURenderer({
      canvas,
      antialias: true,
      trackTimestamp: true,
      device,
    });
    renderer.renderObject = this.createCustomRenderObjectFunction(renderer);
    renderer.setRenderObjectFunction(
      this.createCustomRenderObjectFunction(renderer),
    );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = VSMShadowMap;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    this.renderer = renderer;
    this.monitoringManager = new MonitoringManager();
  }

  private createCustomRenderObjectFunction(
    renderer: WebGPURenderer,
  ): typeof this.renderer.renderObject {
    const defaultRenderObject = renderer.renderObject.bind(renderer);

    return (object, scene, camera, geometry, material, group, ...rest) => {
      if (
        "isInstancedGpuCulledMesh" in object &&
        object.isInstancedGpuCulledMesh
      ) {
        object.onBeforeRender(
          // @ts-expect-error expects a WebGL renderer but need this whole class
          this,
          scene,
          camera,
          geometry,
          material,
          group,
        );
        return; // Skip Three.js default rendering
      }

      // Call the original render function with remaining parameters
      defaultRenderObject(
        object,
        scene,
        camera,
        geometry,
        material,
        group,
        ...rest,
      );
    };
  }

  async initAsync() {
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
