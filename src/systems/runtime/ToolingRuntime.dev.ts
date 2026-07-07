import { Pane } from "tweakpane";
import { DevDebugManager } from "../DebugManager";
import { MonitoringManager } from "../RendererManager/MonitoringManager";
import type { EventsManager } from "../EventsManager";

export const createDebugManager = () => {
  return new DevDebugManager(new Pane({ title: "Revo Realms" }));
};

export const createMonitoringManager = (eventsManager: EventsManager) => {
  return new MonitoringManager(eventsManager, true);
};
