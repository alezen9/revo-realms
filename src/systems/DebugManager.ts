import { Pane } from "tweakpane";

class DebugManager {
  panel: Pane;

  constructor() {
    this.panel = new Pane({ title: "Revo Realms" });
    this.panel.element.parentElement!.style.zIndex = "1";
    this.panel.element.parentElement!.style.width = "340px";
  }
}

export const debugManager = new DebugManager();
