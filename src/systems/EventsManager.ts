import { EventEmitter } from "tseep/lib/ee-safe";
import { State } from "../Game";

type Events = {
  update: (state: State) => void;
  "update-throttled-5": (state: State) => void;
  "update-throttled-30": (state: State) => void;
};

export const eventsManager = new EventEmitter<Events>();

const updateThrottled = (n: 5 | 30) => {
  let frame = 0;
  eventsManager.on("update", (state) => {
    frame++;
    if (frame < n) return;
    frame = 0;
    eventsManager.emit(`update-throttled-${n}`, state);
  });
};

updateThrottled(30);
