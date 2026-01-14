import { EventEmitter } from "tseep/lib/ee-safe";
import { type Sizes, type State } from "../Game";

type UpdateEvent = (state: State) => void;
type ResizeEvent = (sizes: Sizes) => void;

const throttle = [2, 4, 16, 64] as const;
type ThrottledEvents = {
  [T in (typeof throttle)[number] as `engine-update-throttle-${T}x`]: UpdateEvent;
};

type EngineEvents = {
  "engine-update": UpdateEvent;
  "engine-camera-change": VoidFunction;
  "engine-render-target-resize": ResizeEvent;
  "engine-loading-resources-progress": (percentage: number) => void;
  "engine-loading-audio-progress": (percentage: number) => void;
  "engine-loading-core-progress": (percentage: number) => void;
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
  "radial-menu-visibility": (visible: boolean) => void;
};

type Events = EngineEvents &
  InputEvents &
  GameEvents &
  LandmarkEvents & {
    "blow-wind": VoidFunction;
  };

export class EventsManager {
  private emitter = new EventEmitter<Events>();

  constructor() {
    throttle.forEach((n) => this.updateThrottled(n));

    import.meta.hot?.dispose(() => {
      this.removeAllListeners();
    });
  }

  private updateThrottled(n: (typeof throttle)[number]) {
    let frame = 0;
    let accDelta = 0;

    this.on("engine-update", ({ player, delta }) => {
      accDelta += delta;
      frame++;
      if (frame < n) return;

      this.emit(`engine-update-throttle-${n}x`, {
        player,
        delta: accDelta,
      } as State);
      frame = 0;
      accDelta = 0;
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
