import { ACESFilmicToneMapping, PCFShadowMap } from "three";
import { WebGPURenderer } from "three/webgpu";
import { MonitoringManager } from "./MonitoringManager";
import { PostprocessingManager } from "./PostprocessingManager";
import { sceneManager } from "..";
import { type DebugManager } from "../DebugManager";
import { type EventsManager } from "../EventsManager";

const ENABLE_MONITORING = true;
const ENABLE_DEBUGGING = true;

export class RendererManager {
  renderer: WebGPURenderer;
  canvas: HTMLCanvasElement;
  isWebGPU!: boolean;
  private prevFrame: Promise<any> | null = null;
  private monitoringManager: MonitoringManager;
  private postprocessingManager!: PostprocessingManager;
  private readonly IS_POSTPROCESSING_ENABLED = true;
  private readonly IS_MONITORING_ENABLED =
    import.meta.env.DEV && ENABLE_MONITORING;
  private readonly IS_DEBUGGING_ENABLED =
    import.meta.env.DEV && ENABLE_DEBUGGING;
  private timeScale = 1;

  constructor(debugManager: DebugManager, eventsManager: EventsManager) {
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
    renderer.setClearColor(0x000000, 1);

    renderer.toneMappingExposure = 1.5;
    this.renderer = renderer;
    this.monitoringManager = new MonitoringManager(this.IS_MONITORING_ENABLED);
    debugManager.setVisibility(this.IS_DEBUGGING_ENABLED);

    eventsManager.on("engine-render-target-resize", (sizes) => {
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
    this.patchNodeFrameTimeScale();
    sceneManager.init();
    this.isWebGPU = !!(await navigator.gpu?.requestAdapter());
    this.postprocessingManager = new PostprocessingManager(this.renderer);
    if (this.IS_MONITORING_ENABLED) {
      this.renderer.info.autoReset = false;
      await this.monitoringManager.stats.init(this.renderer);
    }
  }

  setTimeScale(scale: number) {
    this.timeScale = Math.max(0, scale);
  }

  private patchNodeFrameTimeScale() {
    // Hook NodeFrame so TSL `time`/`deltaTime` follow the game time scale.
    const renderer = this.renderer as unknown as {
      _nodes?: {
        nodeFrame?: {
          update: () => void;
          time: number;
          deltaTime: number;
          __timeScalePatched?: boolean;
        };
      };
    };
    const nodeFrame = renderer?._nodes?.nodeFrame;
    if (!nodeFrame || nodeFrame.__timeScalePatched) return;
    nodeFrame.__timeScalePatched = true;
    const originalUpdate = nodeFrame.update.bind(nodeFrame);
    const getTimeScale = () => this.timeScale;

    nodeFrame.update = () => {
      const previousTime = nodeFrame.time;
      originalUpdate();
      const scale = getTimeScale();
      if (scale === 1) return;
      const scaledDelta = nodeFrame.deltaTime * scale;
      nodeFrame.deltaTime = scaledDelta;
      nodeFrame.time = previousTime + scaledDelta;
    };
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
    // Consume last frame’s results now (they should be ready)
    this.prevFrame
      ?.then(() => {
        this.monitoringManager.updateCustomPanels(this);
        this.monitoringManager.stats.update();
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

  async renderAsync() {
    if (this.IS_MONITORING_ENABLED) this.renderWithMonitoring();
    else this.renderSceneAsync();
  }
}
