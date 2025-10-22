import { debugManager } from "../DebugManager";
import { WindState } from "./WindState";

class SystemState {
  readonly wind: WindState;
  constructor() {
    const folder = debugManager.panel.addFolder({ title: "🧠 State" });
    this.wind = new WindState(folder);
  }
}

export const systemState = new SystemState();
