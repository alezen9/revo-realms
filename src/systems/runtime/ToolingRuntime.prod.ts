import { Pane } from "tweakpane";
import { DebugManager, DevDebugManager } from "../DebugManager";
import type { EventsManager } from "../EventsManager";
import type { FrameScheduler } from "../FrameScheduler";
import type { PhysicsScheduler } from "../PhysicsScheduler";
import { MonitoringManager } from "../RendererManager/MonitoringManager";
import type { RendererManager } from "../RendererManager/RendererManager";
import { TOOLING_FLAGS } from "./ToolingFlags";

export const createDebugManager = () => {
  if (TOOLING_FLAGS.debug)
    return new DevDebugManager(new Pane({ title: "Revo Realms" }));
  return new DebugManager();
};

export const createMonitoringManager = (
  eventsManager: EventsManager,
  rendererManager: RendererManager,
  frameScheduler: FrameScheduler,
  physicsScheduler: PhysicsScheduler,
) => {
  if (!TOOLING_FLAGS.monitoring) return undefined;
  return new MonitoringManager(
    eventsManager,
    rendererManager,
    frameScheduler,
    physicsScheduler,
  );
};

export { TOOLING_FLAGS };
