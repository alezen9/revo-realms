export default class PhysicsManager {
  async init() {
    const rapier = await import("@dimforge/rapier3d-compat");
    await rapier.init();
  }
}
