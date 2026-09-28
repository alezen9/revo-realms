import {
  assets,
  sound,
  debugPanel,
  eventBus,
  performanceMonitor,
  physicsWorld,
  graphics,
  lighting,
} from ".";

export const setupAsync = async () => {
  eventBus.emit("engine-loading-core-progress", 0);
  await debugPanel.initAsync();
  await graphics.init();
  await performanceMonitor.initAsync();
  eventBus.emit("engine-loading-core-progress", 25);
  await Promise.all([physicsWorld.initAsync(), assets.initAsync(graphics)]);
  graphics.initFramePipeline({ lighting, assets, performanceMonitor });
  eventBus.emit("engine-loading-core-progress", 75);
  sound
    .initAsync()
    .catch((error) => console.error("[setup] Audio init failed.", error)); // bg loading
};
