import { debugManager } from "../DebugManager";
import { WindStateTsushima } from "./WindStateTsushima";

class SystemState {
  readonly wind: WindStateTsushima;
  constructor() {
    const folder = debugManager.panel.addFolder({ title: "🧠 State" });
    this.wind = new WindStateTsushima(folder);
  }
}

export const systemState = new SystemState();
