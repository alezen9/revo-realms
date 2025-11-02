import UiRoot from "../ui/index.svelte";
import { mount, unmount } from "svelte";

export class UIManager {
  constructor() {}

  init() {
    this.mountSvelte();
  }

  private mountSvelte() {
    const ui = mount(UiRoot, { target: document.body });
    import.meta.hot?.dispose(() => {
      unmount(ui);
    });
  }

  fadeInWindIcon() {
    const element = document.getElementById("wind-icon");
    if (!element) return;
    element.classList.remove(
      "wind-icon-container-fade-out",
      "wind-icon-container-fade-in",
    );
    element.classList.add("wind-icon-container-fade-in");
  }

  fadeOutWindIcon() {
    const element = document.getElementById("wind-icon");
    if (!element) return;
    element.classList.remove(
      "wind-icon-container-fade-out",
      "wind-icon-container-fade-in",
    );
    element.classList.add("wind-icon-container-fade-out");
  }
}
