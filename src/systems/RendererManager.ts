import { ACESFilmicToneMapping, VSMShadowMap } from "three";
import { WebGPURenderer } from "three/webgpu";

export default class RendererManager {
  renderer: WebGPURenderer;
  canvas: HTMLCanvasElement;

  constructor() {
    const canvas = document.createElement("canvas");
    canvas.classList.add("revo-realms");
    document.body.appendChild(canvas);
    this.canvas = canvas;

    const renderer = new WebGPURenderer({
      canvas,
      antialias: true,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = VSMShadowMap;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    this.renderer = renderer;
  }
}
