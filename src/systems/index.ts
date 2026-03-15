import { AssetManager } from "./AssetManager/AssetManager";
import { AudioManager } from "./AudioManager";
import { EventsManager } from "./EventsManager";
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
  const sceneManager = new SceneManager(eventsManager);
  const debugManager = createDebugManager();
  const monitoringManager = createMonitoringManager();

  const rendererManager = new RendererManager(
    sceneManager,
    debugManager,
    eventsManager,
    monitoringManager,
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
  return {
    eventsManager,
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
  };
};

export const {
  eventsManager,
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
} = init();
