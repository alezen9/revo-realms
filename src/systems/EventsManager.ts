import { EventEmitter } from "tseep/lib/ee-safe";
import { Sizes, State } from "../Game";

type UpdateEvent = (state: State) => void;
type ResizeEvent = (sizes: Sizes) => void;

const throttle = [2, 4, 8, 16, 64] as const;
type ThrottledEvents = {
  [T in (typeof throttle)[number] as `update-throttle-${T}x`]: UpdateEvent;
};

type Events = {
  update: UpdateEvent;
  "audio-ready": VoidFunction;
  "camera-changed": VoidFunction;
  resize: ResizeEvent;
} & ThrottledEvents;

export const eventsManager = new EventEmitter<Events>();

const updateThrottled = (n: (typeof throttle)[number]) => {
  let frame = 0;
  let accDelta = 0;
  eventsManager.on("update", ({ player, delta }) => {
    accDelta += delta;
    frame++;
    if (frame < n) return;
    eventsManager.emit(`update-throttle-${n}x`, { player, delta: accDelta });
    frame = 0;
    accDelta = 0;
  });
};
throttle.forEach((n) => updateThrottled(n));
