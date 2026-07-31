import type { FrameScheduler } from "../FrameScheduler";
import type { PhysicsScheduler } from "../PhysicsScheduler";
import type {
  EventsManager,
  GrassMonitoringStats,
  MonitoringSnapshot,
} from "../EventsManager";
import { type RendererManager } from "./RendererManager";

const SNAPSHOT_INTERVAL_MS = 1000;
const LATE_FRAME_TOLERANCE_MS = 1;

type MonitoringProviders = {
  grass: () => Promise<GrassMonitoringStats>;
};

type MonitoringProviderValues = {
  grass: GrassMonitoringStats | null;
};

type MonitoringProviderLoading = {
  grass: boolean;
};

export class MonitoringManager {
  private eventsManager: EventsManager;
  private rendererManager: RendererManager;
  private frameScheduler: FrameScheduler;
  private physicsScheduler: PhysicsScheduler;
  private lastSnapshotUpdate = performance.now();
  private lastRenderSampleTime = 0;
  private frameCount = 0;
  private physicsStepCount = 0;
  private frameMsSum = 0;
  private frameMsCount = 0;
  private lateFrames = 0;
  private targetFps = 0;
  private effectiveFps = 0;
  private refreshHz = 0;
  private divisor = 1;
  private alpha = 0;
  private drawCalls = 0;
  private triangles = 0;
  private providers: Partial<MonitoringProviders> = {};
  private providerValues: MonitoringProviderValues = { grass: null };
  private providerLoading: MonitoringProviderLoading = { grass: false };
  private readonly snapshotInterval: ReturnType<typeof window.setInterval>;
  private readonly unsubscribePhysics: VoidFunction;

  constructor(
    eventsManager: EventsManager,
    rendererManager: RendererManager,
    frameScheduler: FrameScheduler,
    physicsScheduler: PhysicsScheduler,
  ) {
    this.eventsManager = eventsManager;
    this.rendererManager = rendererManager;
    this.frameScheduler = frameScheduler;
    this.physicsScheduler = physicsScheduler;
    this.snapshotInterval = window.setInterval(
      this.onSnapshotInterval,
      SNAPSHOT_INTERVAL_MS,
    );
    this.unsubscribePhysics = this.eventsManager.on(
      "engine-after-physics",
      this.onPhysicsStep,
    );
    import.meta.hot?.dispose(this.dispose);
  }

  registerProvider<T extends keyof MonitoringProviders>(
    name: T,
    provider: MonitoringProviders[T],
  ) {
    this.providers[name] = provider;
  }

  sample(renderTimestamp: DOMHighResTimeStamp) {
    this.frameCount++;

    this.targetFps = this.frameScheduler.targetFps;
    this.effectiveFps = this.frameScheduler.effectiveFps;
    this.refreshHz = this.frameScheduler.refreshHz;
    this.divisor = this.frameScheduler.divisor;
    this.alpha = this.physicsScheduler.alpha;

    const budgetMs = 1000 / this.effectiveFps;
    if (this.lastRenderSampleTime > 0) {
      const frameIntervalMs = renderTimestamp - this.lastRenderSampleTime;
      this.frameMsSum += frameIntervalMs;
      this.frameMsCount++;
      if (frameIntervalMs > budgetMs + LATE_FRAME_TOLERANCE_MS)
        this.lateFrames++;
    }
    this.lastRenderSampleTime = renderTimestamp;

    const { render } = this.rendererManager.renderer.info;
    this.drawCalls = render.drawCalls;
    this.triangles = render.triangles;
  }

  private onSnapshotInterval = () => {
    this.refreshProviders();
    this.emitSnapshot();
  };

  private onPhysicsStep = () => {
    this.physicsStepCount++;
  };

  private refreshProviders() {
    this.refreshGrassProvider();
  }

  private async refreshGrassProvider() {
    const provider = this.providers.grass;
    if (!provider || this.providerLoading.grass) return;

    this.providerLoading.grass = true;
    try {
      this.providerValues.grass = await provider();
    } catch (error) {
      console.error("[Monitoring] grass provider failed:", error);
    } finally {
      this.providerLoading.grass = false;
    }
  }

  private emitSnapshot() {
    const now = performance.now();
    const elapsedMs = now - this.lastSnapshotUpdate;
    if (this.frameCount === 0) {
      this.lastSnapshotUpdate = now;
      return;
    }

    const grass = this.providerValues.grass;
    const triangles = grass
      ? this.triangles - grass.totalTriangles + grass.renderedTriangles
      : this.triangles;
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
        budgetMs: 1000 / this.effectiveFps,
        averageMs: averageFrameMs,
        lateFrames: this.lateFrames,
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
        triangles,
        grass,
      },
    };

    this.eventsManager.emit("engine-monitoring-update", snapshot);
    this.lastSnapshotUpdate = now;
    this.frameCount = 0;
    this.physicsStepCount = 0;
    this.frameMsSum = 0;
    this.frameMsCount = 0;
    this.lateFrames = 0;
  }

  private dispose = () => {
    window.clearInterval(this.snapshotInterval);
    this.unsubscribePhysics();
  };
}
