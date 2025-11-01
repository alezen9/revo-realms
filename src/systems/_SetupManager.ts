import {
  assetManager,
  audioManager,
  physicsManager,
  rendererManager,
  uiManager,
} from ".";

export default class _SetupManager {
  constructor() {
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add("is-touch-device");
    }
  }

  async initAsync() {
    uiManager.init();
    await rendererManager.init();
    await Promise.all([
      physicsManager.initAsync(),
      assetManager.initAsync(rendererManager),
    ]);
    audioManager.initAsync(); // bg loading
  }
}
