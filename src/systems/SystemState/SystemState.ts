import { type DebugManager } from "../DebugManager";
import type { EventsManager } from "../EventsManager";
import { WindStateTsushima } from "./WindStateTsushima";

export class SystemState {
  readonly wind: WindStateTsushima;
  constructor(debugManager: DebugManager, eventsManager: EventsManager) {
    const folder = debugManager.panel.addFolder({ title: "🧠 State" });
    this.wind = new WindStateTsushima(folder, eventsManager);
  }
}
