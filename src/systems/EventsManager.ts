import { EventEmitter } from "tseep/lib/ee-safe";
import { State } from "../Game";

type Events = {
  update: (state: State) => void;
};

export const eventsManager = new EventEmitter<Events>();
