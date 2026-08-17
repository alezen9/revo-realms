import { Pane } from "tweakpane";
import { DebugManager, DevDebugManager } from "../DebugManager";
import { MonitoringManager } from "../RendererManager/MonitoringManager";
import type { EventsManager } from "../EventsManager";
import type { FrameScheduler } from "../FrameScheduler";
import type { RendererManager } from "../RendererManager/RendererManager";
import { TOOLING_FLAGS } from "./ToolingFlags";

export const createDebugManager = () => {
  if (!TOOLING_FLAGS.debug) return new DebugManager();
  return new DevDebugManager(new Pane({ title: "Revo Realms" }));
};

export const createMonitoringManager = (
  eventsManager: EventsManager,
  rendererManager: RendererManager,
  frameScheduler: FrameScheduler,
) => {
  if (!TOOLING_FLAGS.monitoring) return undefined;
  return new MonitoringManager(eventsManager, rendererManager, frameScheduler);
};

export { TOOLING_FLAGS };
