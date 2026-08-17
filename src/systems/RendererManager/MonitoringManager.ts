import { attach, type Agrimensor } from "agrimensor";
import type { FrameScheduler } from "../FrameScheduler";
import type {
  DeviceGpuMetrics,
  DeviceMetrics,
  EventsManager,
  GrassMonitoringStats,
  MonitoringSnapshot,
} from "../EventsManager";
import { type RendererManager } from "./RendererManager";

const SNAPSHOT_INTERVAL_MS = 1_000;
const LATE_FRAME_TOLERANCE_MS = 1;
const LARGEST_RESOURCE_COUNT = 5;

type GrassProvider = () => Promise<GrassMonitoringStats>;

type DeviceAccumulator = {
  gpuExecutionSum: number;
  gpuExecutionCount: number;
  gpuGapMs: number;
};

const createAccumulator = (): DeviceAccumulator => ({
  gpuExecutionSum: 0,
  gpuExecutionCount: 0,
  gpuGapMs: 0,
});

export class MonitoringManager {
  private eventsManager: EventsManager;
  private rendererManager: RendererManager;
  private frameScheduler: FrameScheduler;
  private agrimensor?: Agrimensor;
  private lastSnapshotUpdate = performance.now();
  private lastRenderSampleTime = 0;
  private frameCount = 0;
  private lateFrames = 0;
  private device: DeviceAccumulator | null = null;
  private grassProvider?: GrassProvider;
  private grassStats: GrassMonitoringStats | null = null;
  private isGrassPending = false;
  private readonly snapshotInterval: ReturnType<typeof window.setInterval>;

  constructor(
    eventsManager: EventsManager,
    rendererManager: RendererManager,
    frameScheduler: FrameScheduler,
  ) {
    this.eventsManager = eventsManager;
    this.rendererManager = rendererManager;
    this.frameScheduler = frameScheduler;
    this.snapshotInterval = window.setInterval(
      this.onSnapshotInterval,
      SNAPSHOT_INTERVAL_MS,
    );
    eventsManager.on("engine-renderer-ready", this.attachAgrimensor);
    import.meta.hot?.dispose(this.dispose);
  }

  setGrassProvider(provider: GrassProvider) {
    this.grassProvider = provider;
  }

  beginFrame() {
    this.agrimensor?.beginRenderFrame();
  }

  // must run before assets and entities allocate, since agrimensor only tracks
  // resources created after it attaches
  private attachAgrimensor = () => {
    const { backend } = this.rendererManager.renderer;
    const device = "device" in backend ? backend.device : undefined;
    if (!(device instanceof GPUDevice)) {
      console.warn(
        "[agrimensor] no WebGPU device on the backend; not attached",
      );
      return;
    }
    this.agrimensor = attach(device);
  };

  sample(renderTimestamp: DOMHighResTimeStamp) {
    this.frameCount++;

    const budgetMs = 1000 / this.frameScheduler.effectiveFps;
    if (this.lastRenderSampleTime > 0) {
      const frameIntervalMs = renderTimestamp - this.lastRenderSampleTime;
      if (frameIntervalMs > budgetMs + LATE_FRAME_TOLERANCE_MS)
        this.lateFrames++;
    }
    this.lastRenderSampleTime = renderTimestamp;

    this.accumulateDevice();
  }

  private accumulateDevice() {
    const agrimensor = this.agrimensor;
    if (!agrimensor) return;

    const { gpu } = agrimensor.snapshot();
    if (!gpu) return;

    if (!this.device) this.device = createAccumulator();
    const device = this.device;

    const executionMs = gpu.submittedRenderAndComputePassExecutionInMs;
    device.gpuExecutionSum += executionMs;
    device.gpuExecutionCount++;
    device.gpuGapMs = gpu.submittedRenderAndComputePassGapSumInMs;
  }

  private onSnapshotInterval = () => {
    this.refreshGrassStats();
    this.emitSnapshot();
  };

  private async refreshGrassStats() {
    if (!this.grassProvider || this.isGrassPending) return;

    this.isGrassPending = true;
    try {
      this.grassStats = await this.grassProvider();
    } catch (error) {
      console.error("[Monitoring] grass provider failed:", error);
    } finally {
      this.isGrassPending = false;
    }
  }

  private buildDeviceMetrics(): DeviceMetrics | null {
    const agrimensor = this.agrimensor;
    if (!agrimensor) return null;

    const { resources } = agrimensor.snapshot();
    const accumulator = this.device;

    let gpu: DeviceGpuMetrics | null = null;
    if (accumulator && accumulator.gpuExecutionCount > 0) {
      gpu = {
        averageMs: accumulator.gpuExecutionSum / accumulator.gpuExecutionCount,
        gapMs: accumulator.gpuGapMs,
      };
    }

    return {
      liveBytes: resources.liveResourceAllocationSumInBytes,
      peakBytes: resources.liveResourceAllocationPeakInBytes,
      textureBytes: resources.liveTextureAllocationSumInBytes,
      bufferBytes: resources.liveBufferAllocationSumInBytes,
      largestResources: agrimensor.largestResources(LARGEST_RESOURCE_COUNT),
      gpu,
    };
  }

  private emitSnapshot() {
    const now = performance.now();
    const elapsedMs = now - this.lastSnapshotUpdate;
    if (this.frameCount === 0) {
      this.lastSnapshotUpdate = now;
      return;
    }

    const { effectiveFps, refreshHz } = this.frameScheduler;
    const grass = this.grassStats;
    const { triangles } = this.rendererManager.renderer.info.render;

    const snapshot: MonitoringSnapshot = {
      fps: {
        live: this.frameCount / (elapsedMs / 1000),
        target: effectiveFps,
        refreshHz,
        lateFrames: this.lateFrames,
      },
      frameBudgetMs: 1000 / effectiveFps,
      sampleRateMs: SNAPSHOT_INTERVAL_MS,
      sceneTriangles: grass
        ? triangles - grass.allocatedTriangles + grass.renderedTriangles
        : triangles,
      grass,
      device: this.buildDeviceMetrics(),
    };

    this.eventsManager.emit("engine-monitoring-update", snapshot);
    this.lastSnapshotUpdate = now;
    this.frameCount = 0;
    this.lateFrames = 0;
    this.device = null;
  }

  private dispose = () => {
    window.clearInterval(this.snapshotInterval);
    const agrimensor = this.agrimensor;
    // dropped first: beginRenderFrame throws on a destroyed instance
    this.agrimensor = undefined;
    agrimensor?.destroy();
  };
}
