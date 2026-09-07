import {
  assetManager,
  audioManager,
  debugManager,
  eventsManager,
  monitoringManager,
  physicsManager,
  rendererManager,
} from ".";

export const setupAsync = async () => {
  eventsManager.emit("engine-loading-core-progress", 0);
  await debugManager.initAsync();
  await rendererManager.init();
  await monitoringManager.initAsync();
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
