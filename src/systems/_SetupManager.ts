import {
  assetManager,
  audioManager,
  eventsManager,
  physicsManager,
  rendererManager,
} from ".";

export default class _SetupManager {
  constructor() {
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add("is-touch-device");
    }
  }

  async initAsync() {
    eventsManager.emit("engine-loading-core-progress", 0);
    await rendererManager.init();
    await Promise.all([
      physicsManager.initAsync(),
      assetManager.initAsync(rendererManager),
    ]);
    eventsManager.emit("engine-loading-core-progress", 100);
    audioManager.initAsync(); // bg loading
  }
}
