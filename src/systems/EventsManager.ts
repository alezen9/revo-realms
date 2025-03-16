import { EventEmitter } from "tseep";
import { State } from "../Game";

type Events = {
  update: (state: State) => void;
};

export const eventsManager = new EventEmitter<Events>();
