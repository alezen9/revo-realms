import { AssetManager } from "./AssetManager/AssetManager";
import { AudioManager } from "./AudioManager";
import { DebugManager } from "./DebugManager";
import { EventsManager } from "./EventsManager";
import { InputManager } from "./InputManager";
import { LandmarkManager } from "./LandmarkManager";
import { LightingManager } from "./LightingManager";
import { PhysicsManager } from "./PhysicsManager";
import { RendererManager } from "./RendererManager/RendererManager";
import { SceneManager } from "./SceneManager";
import { SystemState } from "./SystemState/SystemState";
import { UIManager } from "./UIManager";

const init = () => {
  const assetManager = new AssetManager();
  const eventsManager = new EventsManager();
  const sceneManager = new SceneManager(eventsManager);
  const audioManager = new AudioManager(sceneManager);
  const debugManager = new DebugManager();
  const rendererManager = new RendererManager(debugManager, eventsManager);
  const inputManager = new InputManager();
  const physicsManager = new PhysicsManager();
  const uiManager = new UIManager();
  const landmarkManager = new LandmarkManager(eventsManager);
  const systemState = new SystemState(debugManager, eventsManager);
  const lightingManager = new LightingManager(
    sceneManager,
    debugManager,
    eventsManager,
  );
  return {
    eventsManager,
    lightingManager,
    sceneManager,
    rendererManager,
    assetManager,
    audioManager,
    debugManager,
    inputManager,
    physicsManager,
    uiManager,
    landmarkManager,
    systemState,
  };
};

export const {
  eventsManager,
  lightingManager,
  sceneManager,
  rendererManager,
  assetManager,
  audioManager,
  debugManager,
  inputManager,
  physicsManager,
  uiManager,
  landmarkManager,
  systemState,
} = init();
