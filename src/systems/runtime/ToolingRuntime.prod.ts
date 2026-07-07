import { DebugManager } from "../DebugManager";
import type { EventsManager } from "../EventsManager";
import type { MonitoringManager } from "../RendererManager/MonitoringManager";

export const createDebugManager = () => {
  return new DebugManager();
};

export const createMonitoringManager = (
  _eventsManager?: EventsManager,
): MonitoringManager | undefined => {
  return undefined;
};
