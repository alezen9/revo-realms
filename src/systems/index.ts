import { AssetManager } from "./AssetManager/AssetManager";
import { AudioManager } from "./AudioManager";
import { CullingManager } from "./CullingManager";
import { EventsManager } from "./EventsManager";
import { FrameScheduler } from "./FrameScheduler";
import { InputManager } from "./InputManager";
import { LandmarkManager } from "./LandmarkManager";
import { LightingManager } from "./LightingManager";
import { PhysicsManager } from "./PhysicsManager";
import { PhysicsScheduler } from "./PhysicsScheduler";
import { RendererManager } from "./RendererManager/RendererManager";
import { SceneManager } from "./SceneManager";
import { TimeManager } from "./TimeManager";
import { WindManager } from "./WindManager";
import { PrewarmManager } from "./PrewarmManager";
import {
  createDebugManager,
  createMonitoringManager,
  TOOLING_FLAGS,
} from "@systems-tooling-runtime";

const init = () => {
  const eventsManager = new EventsManager();
  const frameScheduler = new FrameScheduler();
  const sceneManager = new SceneManager(eventsManager);
  const cullingManager = new CullingManager(eventsManager, sceneManager);
  const debugManager = createDebugManager();

  const rendererManager = new RendererManager(
    sceneManager,
    debugManager,
    eventsManager,
    TOOLING_FLAGS.debug,
  );
  const prewarmManager = new PrewarmManager(rendererManager, sceneManager);
  const assetManager = new AssetManager(eventsManager);
  const audioManager = new AudioManager(sceneManager, eventsManager);
  const inputManager = new InputManager(eventsManager);
  const physicsManager = new PhysicsManager(
    sceneManager,
    audioManager,
    debugManager,
  );
  const physicsScheduler = new PhysicsScheduler();
  const monitoringManager = createMonitoringManager(
    eventsManager,
    rendererManager,
    frameScheduler,
    physicsScheduler,
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
  return {
    eventsManager,
    frameScheduler,
    lightingManager,
    sceneManager,
    cullingManager,
    rendererManager,
    monitoringManager,
    prewarmManager,
    assetManager,
    audioManager,
    debugManager,
    inputManager,
    physicsManager,
    physicsScheduler,
    timeManager,
    landmarkManager,
    windManager,
  };
};

export const {
  eventsManager,
  frameScheduler,
  lightingManager,
  sceneManager,
  cullingManager,
  rendererManager,
  monitoringManager,
  prewarmManager,
  assetManager,
  audioManager,
  debugManager,
  inputManager,
  physicsManager,
  physicsScheduler,
  timeManager,
  landmarkManager,
  windManager,
} = init();
