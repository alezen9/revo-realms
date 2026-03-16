import type { Pane } from "tweakpane";

const NOOP_BINDING = {
  on: () => NOOP_BINDING,
};

const NOOP_PANEL = {
  hidden: true,
  addFolder: () => NOOP_PANEL,
  // @ts-expect-error
  addBinding: () => NOOP_BINDING,
} satisfies Pane;

type DebugPaneLike = {
  hidden: boolean;
  element?: HTMLElement;
  addFolder: (...args: any[]) => any;
  addBinding: (...args: any[]) => {
    on: (...args: any[]) => any;
  };
};

export class DebugManager {
  panel: Pane = NOOP_PANEL;
  isEnabled = false;

  setVisibility(_visible: boolean) {}
}

export class DevDebugManager extends DebugManager {
  constructor(panel: Pane) {
    super();
    panel.element?.parentElement?.classList.add("debug-panel");
    panel.hidden = false;
    this.panel = panel;
    this.isEnabled = true;
  }

  setVisibility(visible: boolean) {
    this.panel.hidden = !visible;
  }
}
