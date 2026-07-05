import { Pane } from "tweakpane";
import { DevDebugManager } from "../DebugManager";
import { MonitoringManager } from "../MonitoringManager";

export const createDebugManager = () => {
  return new DevDebugManager(new Pane({ title: "Revo Realms" }));
};

export const createMonitoringManager = () => {
  return new MonitoringManager();
};
