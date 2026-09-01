import {
  assetManager,
  audioManager,
  eventsManager,
  physicsManager,
  rendererManager,
} from ".";

export const setupAsync = async () => {
  eventsManager.emit("engine-loading-core-progress", 0);
  await rendererManager.init();
  eventsManager.emit("engine-loading-core-progress", 25);
  await Promise.all([
    physicsManager.initAsync(),
    assetManager.initAsync(rendererManager),
  ]);
  rendererManager.initPostprocessing();
  eventsManager.emit("engine-loading-core-progress", 75);
  audioManager
    .initAsync()
    .catch((error) => console.error("[setup] Audio init failed.", error)); // bg loading
};
