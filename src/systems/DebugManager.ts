import { Pane } from "tweakpane";

class DebugManager {
  panel: Pane;

  constructor() {
    this.panel = new Pane({ title: "Revo Realms" });
    this.panel.hidden = !import.meta.env.DEV;
    this.panel.element.parentElement?.classList.add("debug-panel");
  }

  setVisibility(visible: boolean) {
    this.panel.hidden = !visible;
  }
}

export const debugManager = new DebugManager();
