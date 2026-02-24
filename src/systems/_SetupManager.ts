import { Utils } from "../utils/Utils";
import {
  assetManager,
  audioManager,
  eventsManager,
  physicsManager,
  rendererManager,
} from ".";

export default class _SetupManager {
  async initAsync() {
    eventsManager.emit("engine-loading-core-progress", 0);
    await rendererManager.init();
    eventsManager.emit("engine-loading-core-progress", 25);
    await Promise.all([
      physicsManager.initAsync(),
      assetManager.initAsync(rendererManager),
    ]);
    eventsManager.emit("engine-loading-core-progress", 75);
    audioManager.initAsync(); // bg loading
    Utils.init();
  }
}
