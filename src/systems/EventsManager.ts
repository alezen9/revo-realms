import { EventEmitter } from "tseep/lib/ee-safe";
import { State } from "../Game";

type UpdateEvent = (state: State) => void;

const throttle = [2, 4, 8, 60] as const;
type ThrottledEvents = {
  [T in (typeof throttle)[number] as `update-throttle-${T}x`]: UpdateEvent;
};

type Events = {
  update: UpdateEvent;
  "audio-ready": VoidFunction;
} & ThrottledEvents;

export const eventsManager = new EventEmitter<Events>();

const updateThrottled = (n: (typeof throttle)[number]) => {
  let frame = 0;
  eventsManager.on("update", (state) => {
    frame++;
    if (frame < n) return;
    frame = 0;
    eventsManager.emit(`update-throttle-${n}x`, state);
  });
};
throttle.forEach((n) => updateThrottled(n));
