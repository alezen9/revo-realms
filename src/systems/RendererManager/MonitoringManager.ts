import type { FrameScheduler } from "../FrameScheduler";
import type { PhysicsScheduler } from "../PhysicsScheduler";
import type { EventsManager, MonitoringSnapshot } from "../EventsManager";
import { type RendererManager } from "./RendererManager";

const SNAPSHOT_INTERVAL_MS = 1000;

type MonitoringSample = {
  rendererManager: RendererManager;
  frameScheduler: FrameScheduler;
  physicsScheduler: PhysicsScheduler;
};

export class MonitoringManager {
  private eventsManager: EventsManager;
  private lastSnapshotUpdate = performance.now();
  private lastSampleTime = 0;
  private frameCount = 0;
  private physicsStepCount = 0;
  private frameMsSum = 0;
  private frameMsCount = 0;
  private currentFrameMs = 0;
  private targetFps = 0;
  private effectiveFps = 0;
  private refreshHz = 0;
  private divisor = 1;
  private alpha = 0;
  private drawCalls = 0;
  private triangles = 0;
  private enabled: boolean;
  private snapshotInterval?: ReturnType<typeof window.setInterval>;

  constructor(eventsManager: EventsManager, enabled: boolean) {
    this.eventsManager = eventsManager;
    this.enabled = enabled;
    if (this.enabled) {
      this.snapshotInterval = window.setInterval(
        this.emitSnapshot,
        SNAPSHOT_INTERVAL_MS,
      );
      import.meta.hot?.dispose(this.dispose);
    }
  }

  sample(sample: MonitoringSample) {
    const { rendererManager, frameScheduler, physicsScheduler } = sample;
    const now = performance.now();

    this.frameCount++;
    this.physicsStepCount += physicsScheduler.steps;

    if (this.lastSampleTime > 0) {
      this.currentFrameMs = now - this.lastSampleTime;
      this.frameMsSum += this.currentFrameMs;
      this.frameMsCount++;
    }
    this.lastSampleTime = now;

    this.targetFps = frameScheduler.targetFps;
    this.effectiveFps = frameScheduler.effectiveFps;
    this.refreshHz = frameScheduler.refreshHz;
    this.divisor = frameScheduler.divisor;
    this.alpha = physicsScheduler.alpha;

    const { render } = rendererManager.renderer.info;
    this.drawCalls = render.drawCalls;
    this.triangles = render.triangles;
  }

  private emitSnapshot = () => {
    if (!this.enabled) return;
    const now = performance.now();
    const elapsedMs = now - this.lastSnapshotUpdate;
    if (this.frameCount === 0) {
      this.lastSnapshotUpdate = now;
      return;
    }

    const elapsedSeconds = elapsedMs / 1000;
    const currentFps = this.frameCount / elapsedSeconds;
    const averageFrameMs =
      this.frameMsCount > 0 ? this.frameMsSum / this.frameMsCount : 0;
    const physicsRate = this.physicsStepCount / elapsedSeconds;

    const snapshot: MonitoringSnapshot = {
      fps: {
        current: currentFps,
        effective: this.effectiveFps,
        target: this.targetFps,
      },
      frame: {
        currentMs: this.currentFrameMs,
        budgetMs: 1000 / this.targetFps,
        averageMs: averageFrameMs,
      },
      sync: {
        refreshHz: this.refreshHz,
        divisor: this.divisor,
        alpha: this.alpha,
      },
      physics: {
        rate: physicsRate,
      },
      render: {
        calls: this.drawCalls,
        triangles: this.triangles,
      },
    };

    this.eventsManager.emit("engine-monitoring-update", snapshot);
    this.lastSnapshotUpdate = now;
    this.frameCount = 0;
    this.physicsStepCount = 0;
    this.frameMsSum = 0;
    this.frameMsCount = 0;
  };

  private dispose = () => {
    if (!this.snapshotInterval) return;
    window.clearInterval(this.snapshotInterval);
    this.snapshotInterval = undefined;
  };
}
