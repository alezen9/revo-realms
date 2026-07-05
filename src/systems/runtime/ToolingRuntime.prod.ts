import { DebugManager } from "../DebugManager";
import type { MonitoringManager } from "../MonitoringManager";

export const createDebugManager = () => {
  return new DebugManager();
};

export const createMonitoringManager = (): MonitoringManager | undefined => {
  return undefined;
};
