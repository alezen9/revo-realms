import { type DebugManager } from "../DebugManager";
import { WindStateTsushima } from "./WindStateTsushima";

export class SystemState {
  readonly wind: WindStateTsushima;
  constructor(debugManager: DebugManager) {
    const folder = debugManager.panel.addFolder({ title: "🧠 State" });
    this.wind = new WindStateTsushima(folder);
  }
}
