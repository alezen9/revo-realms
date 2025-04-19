import { assetManager } from "./AssetManager";
import { audioManager } from "./AudioManager";
import { physicsManager } from "./PhysicsManager";

export default class _SetupManager {
  constructor() {
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add("is-touch-device");
    }
  }

  async initAsync() {
    audioManager.initAsync(); // bg loading
    await Promise.all([physicsManager.initAsync(), assetManager.initAsync()]);
  }
}
