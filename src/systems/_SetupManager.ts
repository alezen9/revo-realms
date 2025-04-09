import { assetManager } from "./AssetManager";
import audioManager from "./AudioManager";
import { physics } from "./Physics";

export default class _SetupManager {
  async initAsync() {
    await Promise.all([
      physics.initAsync(),
      assetManager.initAsync(),
      audioManager.initAsync(),
    ]);
  }
}
