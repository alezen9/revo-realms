import { AssetManager } from "./AssetManager/AssetManager";
import { AudioManager } from "./AudioManager";
import { DebugManager } from "./DebugManager";
import { InputManager } from "./InputManager";
import { LightingManager } from "./LightingManager";
import { LoadingManager } from "./LoadingManager";
import { PhysicsManager } from "./PhysicsManager";
import { RendererManager } from "./RendererManager/RendererManager";
import { SceneManager } from "./SceneManager";
import { SystemState } from "./SystemState/SystemState";
import { UIManager } from "./UIManager";

const init = () => {
  const sceneManager = new SceneManager();
  const { manager } = new LoadingManager();
  const assetManager = new AssetManager(manager);
  const audioManager = new AudioManager(manager, sceneManager);
  const debugManager = new DebugManager();
  const rendererManager = new RendererManager(debugManager);
  const inputManager = new InputManager();
  const physicsManager = new PhysicsManager();
  const uiManager = new UIManager();
  const systemState = new SystemState(debugManager);
  const lightingManager = new LightingManager(sceneManager, debugManager);
  return {
    lightingManager,
    sceneManager,
    rendererManager,
    assetManager,
    audioManager,
    debugManager,
    inputManager,
    physicsManager,
    uiManager,
    systemState,
  };
};

export const {
  lightingManager,
  sceneManager,
  rendererManager,
  assetManager,
  audioManager,
  debugManager,
  inputManager,
  physicsManager,
  uiManager,
  systemState,
} = init();
