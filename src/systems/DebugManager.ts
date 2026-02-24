const NOOP_BINDING = {
  on: () => NOOP_BINDING,
};

const NOOP_PANEL = {
  hidden: true,
  addFolder: () => NOOP_PANEL,
  addBinding: () => NOOP_BINDING,
};

type DebugPaneLike = {
  hidden: boolean;
  element?: HTMLElement;
  addFolder: (...args: any[]) => any;
  addBinding: (...args: any[]) => {
    on: (...args: any[]) => any;
  };
};

export class DebugManager {
  panel: DebugPaneLike = NOOP_PANEL;
  isEnabled = false;

  setVisibility(_visible: boolean) {}
}

export class DevDebugManager extends DebugManager {
  constructor(panel: DebugPaneLike) {
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
