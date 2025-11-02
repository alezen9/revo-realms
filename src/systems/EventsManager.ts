import { EventEmitter } from "tseep/lib/ee-safe";
import { type Sizes, type State } from "../Game";

type UpdateEvent = (state: State) => void;
type ResizeEvent = (sizes: Sizes) => void;

const throttle = [2, 4, 8, 16, 64] as const;
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
} & ThrottledEvents;

type InputEvents = {
  "swipe-up": VoidFunction;
};

type GameEvents = {
  "game-wind-start": VoidFunction;
  "game-wind-end": VoidFunction;
};

type Events = EngineEvents &
  InputEvents &
  GameEvents & {
    "blow-wind": VoidFunction;
  };

export class EventsManager extends EventEmitter<Events> {
  constructor() {
    super();
    throttle.forEach((n) => this.updateThrottled(n));
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
}
