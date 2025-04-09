import { World } from "@dimforge/rapier3d";

class Physics {
  world!: World;
  constructor() {}

  async initAsync() {
    return import("@dimforge/rapier3d").then(() => {
      this.world = new World({ x: 0, y: -9.81, z: 0 });
    });
  }

  update() {
    this.world.step();
  }
}

export const physics = new Physics();
