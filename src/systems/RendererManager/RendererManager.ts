import { PCFShadowMap } from "three";
import { WebGPURenderer } from "three/webgpu";
import { PostprocessingManager } from "./PostprocessingManager";
import { type DebugManager } from "../DebugManager";
import { type EventsManager } from "../EventsManager";
import type { SceneManager } from "../SceneManager";

type ShadowMapWithTransmission = WebGPURenderer["shadowMap"] & {
  transmitted: boolean;
};

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
    this.debugManager.setVisibility(isDebugEnabled);

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

  async renderAsync() {
    this.renderScene();
  }
}
