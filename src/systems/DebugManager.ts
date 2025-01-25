import GUI from "lil-gui";

class DebugManager {
  panel: GUI;

  constructor() {
    this.panel = new GUI({ width: 340, title: "Revo Realms" });
  }
}

export const debugManager = new DebugManager();
