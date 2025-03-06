import { assetManager } from "./AssetManager";
import { physics } from "./Physics";

export default class _SetupManager {
  async initAsync() {
    await Promise.all([physics.init(), assetManager.initAsync()]);
  }
}
