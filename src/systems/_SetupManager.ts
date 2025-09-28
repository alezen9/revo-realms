import { assetManager } from "./AssetManager";
import { audioManager } from "./AudioManager";
import { physicsManager } from "./PhysicsManager";
import { rendererManager } from "./RendererManager";

export default class _SetupManager {
  constructor() {
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add("is-touch-device");
    }
  }

  async initAsync() {
    await Promise.all([physicsManager.initAsync(), assetManager.initAsync()]);
    await rendererManager.init();
    audioManager.initAsync(); // bg loading
  }
}
