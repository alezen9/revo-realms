import { EventEmitter } from "tseep/lib/ee-safe";
import { type Sizes, type State } from "../Game";

type UpdateEvent = (state: State) => void;
type ResizeEvent = (sizes: Sizes) => void;

export type MonitoringSnapshot = {
  fps: {
    current: number;
    effective: number;
    target: number;
  };
  frame: {
    budgetMs: number;
    averageMs: number;
    lateFrames: number;
  };
  sync: {
    refreshHz: number;
    divisor: number;
    alpha: number;
  };
  physics: {
    rate: number;
  };
  render: {
    calls: number;
    triangles: number;
    grass: GrassMonitoringStats | null;
  };
};

export type GrassMonitoringStats = {
  rendered: number;
  renderedPerLod: number[];
  total: number;
  segmentsPerLod: number[];
  drawCalls: number;
  totalTriangles: number;
  renderedTriangles: number;
};

const throttleLanes = [
  { interval: 2, offset: 0 },
  { interval: 4, offset: 1 },
  { interval: 16, offset: 5 },
  { interval: 64, offset: 17 },
] as const;

type ThrottleInterval = (typeof throttleLanes)[number]["interval"];
type ThrottledEvents = {
  [T in ThrottleInterval as `engine-render-update-throttle-${T}x`]: UpdateEvent;
};

type EngineEvents = {
  "engine-before-physics": UpdateEvent;
  "engine-after-physics": UpdateEvent;
  "engine-render-update": UpdateEvent;
  "engine-camera-change": VoidFunction;
  "engine-render-target-resize": ResizeEvent;
  "engine-loading-resources-progress": (percentage: number) => void;
  "engine-loading-audio-progress": (percentage: number) => void;
  "engine-loading-core-progress": (percentage: number) => void;
  "engine-loading-failed": VoidFunction;
  "engine-monitoring-update": (snapshot: MonitoringSnapshot) => void;
  "engine-time-scale": (scale: number) => void;
  "engine-pause-change": (paused: boolean) => void;
  "engine-slowmo-change": (enabled: boolean) => void;
} & ThrottledEvents;

type InputEvents = {
  "swipe-up": VoidFunction;
};

type GameEvents = {
  "game-wind-start": VoidFunction;
  "game-wind-end": VoidFunction;
  "wind-target-change": (targetId: string | null) => void;
};

type LandmarkEvents = {
  "landmark-discovered": (id: string) => void;
  "landmark-selected": (id: string) => void;
};

type Events = EngineEvents & InputEvents & GameEvents & LandmarkEvents;

export class EventsManager {
  private emitter = new EventEmitter<Events>();
  private frameIndex = 0;
  private throttledDeltaByInterval = new Map<ThrottleInterval, number>();

  constructor() {
    this.updateThrottled();

    import.meta.hot?.dispose(() => {
      this.removeAllListeners();
    });
  }

  private updateThrottled() {
    this.on("engine-render-update", ({ player, delta }) => {
      this.frameIndex++;

      for (const lane of throttleLanes) {
        const { interval, offset } = lane;
        const accDelta =
          (this.throttledDeltaByInterval.get(interval) ?? 0) + delta;
        this.throttledDeltaByInterval.set(interval, accDelta);

        const canEmit = this.frameIndex >= interval + offset;
        if (!canEmit) continue;
        if ((this.frameIndex - offset) % interval !== 0) continue;

        this.emit(`engine-render-update-throttle-${interval}x`, {
          player,
          delta: accDelta,
        } as State);
        this.throttledDeltaByInterval.set(interval, 0);
      }
    });
  }

  on<K extends keyof Events>(event: K, listener: Events[K]): () => void {
    this.emitter.on(event, listener);
    return () => {
      this.emitter.off(event, listener);
    };
  }

  emit<K extends keyof Events>(
    event: K,
    ...args: Parameters<Events[K]>
  ): boolean {
    return this.emitter.emit(event, ...args);
  }

  off<K extends keyof Events>(event: K, listener: Events[K]) {
    this.emitter.off(event, listener);
  }

  removeAllListeners<K extends keyof Events>(event?: K) {
    this.emitter.removeAllListeners(event);
  }
}
