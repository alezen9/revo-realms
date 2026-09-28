import { EventEmitter } from "tseep/lib/ee-safe";
import type { MonitoringSnapshot } from "../monitoring/monitoringTypes";
import { type Sizes, type State } from "../../Game";

type UpdateEvent = (state: State) => void;
type ResizeEvent = (sizes: Sizes) => void;

export type LoadingFailure = {
  headline: string;
  hint: string;
};

const throttleLanes = [
  { interval: 2, offset: 0, event: "engine-render-update-throttle-2x" },
  { interval: 4, offset: 1, event: "engine-render-update-throttle-4x" },
  { interval: 16, offset: 5, event: "engine-render-update-throttle-16x" },
  { interval: 64, offset: 17, event: "engine-render-update-throttle-64x" },
] as const;

type ThrottleInterval = (typeof throttleLanes)[number]["interval"];
type ThrottledEvents = {
  [L in (typeof throttleLanes)[number] as L["event"]]: UpdateEvent;
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
  "engine-loading-failed": (failure?: LoadingFailure) => void;
  "engine-monitoring-update": (snapshot: MonitoringSnapshot) => void;
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

type Events = EngineEvents & InputEvents & GameEvents;

export class EventBus {
  private emitter = new EventEmitter<Events>();
  private frameIndex = 0;
  private throttledDeltaByInterval = new Map<ThrottleInterval, number>();
  private throttledState?: State;

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
        const { interval, offset, event } = lane;
        const accDelta =
          (this.throttledDeltaByInterval.get(interval) ?? 0) + delta;
        this.throttledDeltaByInterval.set(interval, accDelta);

        const canEmit = this.frameIndex >= interval + offset;
        if (!canEmit) continue;
        if ((this.frameIndex - offset) % interval !== 0) continue;

        if (!this.throttledState) this.throttledState = { player, delta: 0 };
        this.throttledState.player = player;
        this.throttledState.delta = accDelta;
        this.emit(event, this.throttledState);
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

  removeAllListeners<K extends keyof Events>(event?: K) {
    this.emitter.removeAllListeners(event);
  }
}
