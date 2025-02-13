import { assetManager } from "./AssetManager";

export default class _SetupManager {
  async initAsync() {
    const rapier = await import("@dimforge/rapier3d-compat");
    await Promise.all([rapier.init(), assetManager.initAsync()]);
  }
}
