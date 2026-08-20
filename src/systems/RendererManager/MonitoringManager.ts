import { attach, type Agrimensor, type PassKind } from "agrimensor";
import type { FrameScheduler } from "../FrameScheduler";
import type { PhysicsScheduler } from "../PhysicsScheduler";
import type { TimeManager } from "../TimeManager";
import type {
  DeviceGpuPassMetrics,
  DeviceGpuMetrics,
  DeviceMetrics,
  EventsManager,
  GrassMonitoringStats,
  MonitoringSnapshot,
} from "../EventsManager";
import { type RendererManager } from "./RendererManager";
import { ThreeMonitoringAdapter } from "./ThreeMonitoringAdapter";

const SNAPSHOT_INTERVAL_MS = 1_000;
const LARGEST_RESOURCE_COUNT = 5;

type GrassProvider = () => Promise<GrassMonitoringStats>;

type PassDurationAccumulator = {
  kind: PassKind;
  label: string;
  sumMs: number;
  count: number;
};

type DeviceAccumulator = {
  renderPassCount: number;
  computePassCount: number;
  computeDispatchCount: number;
  gpuSubmissionCount: number;
  queueWriteMaxBytes: number;
  commandCopyMaxBytes: number;
  pipelineCreationCount: number;
  pipelineBlockingMaxMs: number;
  gpuExecutionSum: number;
  gpuRenderSum: number;
  gpuComputeSum: number;
  gpuGapSum: number;
  gpuExecutionCount: number;
  gpuUninstrumentedPassMax: number;
  drawCallCount: number;
  passDurations: Map<string, PassDurationAccumulator>;
};

const createAccumulator = (): DeviceAccumulator => ({
  renderPassCount: 0,
  computePassCount: 0,
  computeDispatchCount: 0,
  gpuSubmissionCount: 0,
  queueWriteMaxBytes: 0,
  commandCopyMaxBytes: 0,
  pipelineCreationCount: 0,
  pipelineBlockingMaxMs: 0,
  gpuExecutionSum: 0,
  gpuRenderSum: 0,
  gpuComputeSum: 0,
  gpuGapSum: 0,
  gpuExecutionCount: 0,
  gpuUninstrumentedPassMax: 0,
  drawCallCount: 0,
  passDurations: new Map(),
});

type TimingSummary = {
  averageMs: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
};

const summarizeTimings = (samples: number[]): TimingSummary => {
  if (samples.length === 0)
    return { averageMs: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };

  const sorted = [...samples].sort((a, b) => a - b);
  let sum = 0;
  for (const sample of samples) sum += sample;

  const p95Index = Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * 0.95) - 1,
  );
  const p99Index = Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * 0.99) - 1,
  );

  return {
    averageMs: sum / samples.length,
    p95Ms: sorted[p95Index],
    p99Ms: sorted[p99Index],
    maxMs: sorted[sorted.length - 1],
  };
};

export class MonitoringManager {
  private eventsManager: EventsManager;
  private rendererManager: RendererManager;
  private frameScheduler: FrameScheduler;
  private physicsScheduler: PhysicsScheduler;
  private timeManager: TimeManager;
  private agrimensor?: Agrimensor;
  private lastSnapshotUpdate = performance.now();
  private lastRenderSampleTime = 0;
  private frameCount = 0;
  private missedFrames = 0;
  private frameIntervals: number[] = [];
  private physicsStepCount = 0;
  private physicsMaxSteps = 0;
  private physicsDiscardedMs = 0;
  private physicsRemainderMs = 0;
  private device: DeviceAccumulator | null = null;
  private lastDeviceFrameNumber = 0;
  private lastGpuFrameNumber = 0;
  private lastSceneTriangles = 0;
  private grassProvider?: GrassProvider;
  private grassStats: GrassMonitoringStats | null = null;
  private isGrassPending = false;
  private threeAdapter: ThreeMonitoringAdapter;
  private readonly snapshotInterval: ReturnType<typeof window.setInterval>;

  constructor(
    eventsManager: EventsManager,
    rendererManager: RendererManager,
    frameScheduler: FrameScheduler,
    physicsScheduler: PhysicsScheduler,
    timeManager: TimeManager,
  ) {
    this.eventsManager = eventsManager;
    this.rendererManager = rendererManager;
    this.frameScheduler = frameScheduler;
    this.physicsScheduler = physicsScheduler;
    this.timeManager = timeManager;
    this.threeAdapter = new ThreeMonitoringAdapter(rendererManager.renderer);
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

  samplePhysics() {
    const { pendingSteps, alpha, fixedDelta } = this.physicsScheduler;
    const { discardedDelta } = this.timeManager;
    const remainderDelta = alpha * fixedDelta;
    const steps = pendingSteps;
    this.physicsStepCount += steps;
    this.physicsMaxSteps = Math.max(this.physicsMaxSteps, steps);
    this.physicsDiscardedMs += discardedDelta * 1_000;
    this.physicsRemainderMs = remainderDelta * 1_000;
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
    const options = {
      trackPassTimings: true,
      resolvePassLabel: this.threeAdapter.resolvePassLabel,
    };
    this.agrimensor = attach(device, options);
  };

  sampleRender(renderTimestamp: DOMHighResTimeStamp) {
    this.lastSceneTriangles = this.threeAdapter.consumePreviousFrameTriangles();
    this.agrimensor?.beginRenderFrame();
    this.frameCount++;

    const budgetMs = 1000 / this.frameScheduler.effectiveFps;
    if (this.lastRenderSampleTime > 0) {
      const frameIntervalMs = renderTimestamp - this.lastRenderSampleTime;
      this.frameIntervals.push(frameIntervalMs);
      const elapsedRefreshPeriods = Math.max(
        1,
        Math.round(frameIntervalMs / budgetMs),
      );
      this.missedFrames += elapsedRefreshPeriods - 1;
    }
    this.lastRenderSampleTime = renderTimestamp;

    this.accumulateDevice();
  }

  private accumulateDevice() {
    const agrimensor = this.agrimensor;
    if (!agrimensor) return;

    const { frame, gpu } = agrimensor.snapshot();
    if (!frame) return;

    if (!this.device) this.device = createAccumulator();
    const device = this.device;

    if (frame.renderedFrameCount > this.lastDeviceFrameNumber) {
      this.lastDeviceFrameNumber = frame.renderedFrameCount;
      device.renderPassCount = Math.max(
        device.renderPassCount,
        frame.renderPassCount,
      );
      device.computePassCount = Math.max(
        device.computePassCount,
        frame.computePassCount,
      );
      device.computeDispatchCount = Math.max(
        device.computeDispatchCount,
        frame.computeDispatchCount,
      );
      device.gpuSubmissionCount = Math.max(
        device.gpuSubmissionCount,
        frame.gpuSubmissionCount,
      );
      device.queueWriteMaxBytes = Math.max(
        device.queueWriteMaxBytes,
        frame.queueWriteSumInBytes,
      );
      device.commandCopyMaxBytes = Math.max(
        device.commandCopyMaxBytes,
        frame.commandCopySumInBytes,
      );
      device.pipelineCreationCount += frame.pipelineCreationCount;
      device.pipelineBlockingMaxMs = Math.max(
        device.pipelineBlockingMaxMs,
        frame.pipelineCreationBlockingDurationSumInMs,
      );
      device.drawCallCount = frame.drawCallCount;
    }

    if (!gpu) return;

    // derive the measured frame identity so delayed timestamp results are counted once
    const gpuFrameNumber =
      frame.renderedFrameCount + 1 - gpu.resultLagFrameCount;
    if (gpuFrameNumber <= this.lastGpuFrameNumber) return;
    this.lastGpuFrameNumber = gpuFrameNumber;

    device.gpuExecutionSum += gpu.submittedRenderAndComputePassExecutionInMs;
    device.gpuRenderSum += gpu.submittedRenderPassDurationSumInMs;
    device.gpuComputeSum += gpu.submittedComputePassDurationSumInMs;
    device.gpuGapSum += gpu.submittedRenderAndComputePassGapSumInMs;
    device.gpuExecutionCount++;
    device.gpuUninstrumentedPassMax = Math.max(
      device.gpuUninstrumentedPassMax,
      gpu.uninstrumentedPassCount,
    );

    const { passTimings } = gpu;
    if (!passTimings) return;
    for (const pass of passTimings) {
      const key = `${pass.kind}:${pass.label}`;
      const current = device.passDurations.get(key);
      if (current) {
        current.sumMs += pass.durationInMs;
        current.count++;
        continue;
      }
      device.passDurations.set(key, {
        kind: pass.kind,
        label: pass.label,
        sumMs: pass.durationInMs,
        count: 1,
      });
    }
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

  private buildSlowestPasses(accumulator: DeviceAccumulator) {
    const passes: DeviceGpuPassMetrics[] = [];
    for (const pass of accumulator.passDurations.values()) {
      passes.push({
        kind: pass.kind,
        label: pass.label,
        averageMs: pass.sumMs / pass.count,
      });
    }
    passes.sort((a, b) => b.averageMs - a.averageMs);
    return passes.slice(0, 4);
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
        renderAverageMs:
          accumulator.gpuRenderSum / accumulator.gpuExecutionCount,
        computeAverageMs:
          accumulator.gpuComputeSum / accumulator.gpuExecutionCount,
        gapAverageMs: accumulator.gpuGapSum / accumulator.gpuExecutionCount,
        uninstrumentedPassMax: accumulator.gpuUninstrumentedPassMax,
        slowestPasses: this.buildSlowestPasses(accumulator),
      };
    }

    return {
      drawCallCount: accumulator?.drawCallCount ?? 0,
      renderPassCount: accumulator?.renderPassCount ?? 0,
      computePassCount: accumulator?.computePassCount ?? 0,
      computeDispatchCount: accumulator?.computeDispatchCount ?? 0,
      gpuSubmissionCount: accumulator?.gpuSubmissionCount ?? 0,
      queueWriteMaxBytes: accumulator?.queueWriteMaxBytes ?? 0,
      commandCopyMaxBytes: accumulator?.commandCopyMaxBytes ?? 0,
      pipelineCreationCount: accumulator?.pipelineCreationCount ?? 0,
      pipelineBlockingMaxMs: accumulator?.pipelineBlockingMaxMs ?? 0,
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
    const frameIntervals = summarizeTimings(this.frameIntervals);
    const { canvas, renderer } = this.rendererManager;

    const snapshot: MonitoringSnapshot = {
      fps: {
        live: this.frameCount / (elapsedMs / 1000),
        target: effectiveFps,
        refreshHz,
        missedFrames: this.missedFrames,
      },
      frame: {
        intervalAverageMs: frameIntervals.averageMs,
        intervalP95Ms: frameIntervals.p95Ms,
        intervalP99Ms: frameIntervals.p99Ms,
        intervalMaxMs: frameIntervals.maxMs,
      },
      physics: {
        rate: this.physicsStepCount / (elapsedMs / 1_000),
        maxSteps: this.physicsMaxSteps,
        discardedMs: this.physicsDiscardedMs,
        remainderMs: this.physicsRemainderMs,
      },
      output: {
        width: canvas.width,
        height: canvas.height,
        pixelRatio: renderer.getPixelRatio(),
      },
      frameBudgetMs: 1000 / effectiveFps,
      sampleRateMs: SNAPSHOT_INTERVAL_MS,
      sceneTriangles: grass
        ? this.lastSceneTriangles -
          grass.allocatedTriangles +
          grass.renderedTriangles
        : this.lastSceneTriangles,
      grass,
      device: this.buildDeviceMetrics(),
    };

    this.eventsManager.emit("engine-monitoring-update", snapshot);
    this.lastSnapshotUpdate = now;
    this.frameCount = 0;
    this.missedFrames = 0;
    this.frameIntervals = [];
    this.physicsStepCount = 0;
    this.physicsMaxSteps = 0;
    this.physicsDiscardedMs = 0;
    this.device = null;
  }

  private dispose = () => {
    window.clearInterval(this.snapshotInterval);
    this.threeAdapter.dispose();
    const agrimensor = this.agrimensor;
    // dropped first: beginRenderFrame throws on a destroyed instance
    this.agrimensor = undefined;
    agrimensor?.destroy();
  };
}
