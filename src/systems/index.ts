import { AssetManager } from "./AssetManager/AssetManager";
import { AudioManager } from "./AudioManager";
import { EventsManager } from "./EventsManager";
import { FrameScheduler } from "./FrameScheduler";
import { InputManager } from "./InputManager";
import { LandmarkManager } from "./LandmarkManager";
import { LightingManager } from "./LightingManager";
import { PhysicsManager } from "./PhysicsManager";
import { RendererManager } from "./RendererManager/RendererManager";
import { SceneManager } from "./SceneManager";
import { TimeManager } from "./TimeManager";
import { WindManager } from "./WindManager";
import { PrewarmManager } from "./PrewarmManager";
import {
  createDebugManager,
  createMonitoringManager,
} from "@systems-tooling-runtime";

const init = () => {
  const eventsManager = new EventsManager();
  const frameScheduler = new FrameScheduler();
  const sceneManager = new SceneManager(eventsManager);
  const debugManager = createDebugManager();
  const monitoringManager = createMonitoringManager();

  const rendererManager = new RendererManager(
    sceneManager,
    debugManager,
    eventsManager,
  );
  const prewarmManager = new PrewarmManager(rendererManager, sceneManager);
  const assetManager = new AssetManager(eventsManager);
  const audioManager = new AudioManager(sceneManager, eventsManager);
  const inputManager = new InputManager(eventsManager);
  const physicsManager = new PhysicsManager(
    eventsManager,
    sceneManager,
    audioManager,
    debugManager,
  );
  const timeManager = new TimeManager(
    eventsManager,
    inputManager,
    debugManager,
  );
  const landmarkManager = new LandmarkManager(eventsManager);
  const lightingManager = new LightingManager(
    sceneManager,
    debugManager,
    eventsManager,
  );
  const windManager = new WindManager(eventsManager, sceneManager);
  if (monitoringManager) {
    monitoringManager.registerMetric({
      id: "rendered-fps",
      group: "Frame",
      label: "FPS",
      precision: 1,
      history: true,
      chartMin: 0,
      chartMax: 60,
      getValue: () => {
        const interval =
          frameScheduler.diagnostics.acceptedFrameIntervalSeconds;
        return interval > 0 ? 1 / interval : 0;
      },
    });
    monitoringManager.registerMetric({
      id: "raf-fps",
      group: "Frame",
      label: "Display Hz",
      precision: 1,
      history: true,
      chartMin: 0,
      chartMax: 180,
      getValue: () => frameScheduler.diagnostics.rafFps,
    });
    monitoringManager.registerMetric({
      id: "pacing-ms",
      group: "Frame",
      label: "Frame interval (ms)",
      precision: 2,
      history: true,
      chartMin: 0,
      chartMax: 35,
      warnAt: 20,
      dangerAt: 28,
      getValue: () =>
        frameScheduler.diagnostics.acceptedFrameIntervalSeconds * 1000,
    });
    monitoringManager.registerMetric({
      id: "frame-time-ms",
      group: "Frame",
      label: "Frame time (ms)",
      precision: 2,
      history: true,
      chartMin: 0,
      chartMax: 16.67,
      warnAt: 12,
      dangerAt: 16.67,
      getValue: () => frameScheduler.diagnostics.frameWorkSeconds * 1000,
    });
    monitoringManager.registerMetric({
      id: "skipped-frames",
      group: "Frame",
      label: "Skipped frames",
      history: true,
      chartMin: 0,
      chartMax: 4,
      warnAt: 1,
      dangerAt: 3,
      getValue: () => frameScheduler.diagnostics.skippedRafFramesSinceLastTick,
    });
    monitoringManager.registerMetric({
      id: "dropped-time",
      group: "Frame",
      label: "Dropped backlog",
      history: true,
      chartMin: 0,
      chartMax: 10,
      warnAt: 1,
      dangerAt: 3,
      getValue: () => frameScheduler.diagnostics.droppedTimeCount,
    });
    monitoringManager.registerMetric({
      id: "draw-calls",
      group: "Renderer",
      label: "Draw calls",
      history: true,
      chartMin: 0,
      chartMax: 300,
      getValue: () => rendererManager.renderer.info.render.drawCalls,
    });
    monitoringManager.registerMetric({
      id: "triangles",
      group: "Renderer",
      label: "Triangles",
      history: true,
      chartMin: 0,
      chartMax: 2_000_000,
      getValue: () => rendererManager.renderer.info.render.triangles,
    });
  }
  return {
    eventsManager,
    frameScheduler,
    lightingManager,
    sceneManager,
    rendererManager,
    prewarmManager,
    assetManager,
    audioManager,
    debugManager,
    inputManager,
    physicsManager,
    timeManager,
    landmarkManager,
    windManager,
    monitoringManager,
  };
};

export const {
  eventsManager,
  frameScheduler,
  lightingManager,
  sceneManager,
  rendererManager,
  prewarmManager,
  assetManager,
  audioManager,
  debugManager,
  inputManager,
  physicsManager,
  timeManager,
  landmarkManager,
  windManager,
  monitoringManager,
} = init();
