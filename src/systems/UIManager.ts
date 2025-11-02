import UiRoot from "../ui/index.svelte";
import { mount, unmount } from "svelte";

export class UIManager {
  constructor() {
    this.mountSvelte();
  }

  private mountSvelte() {
    const ui = mount(UiRoot, { target: document.body });
    import.meta.hot?.dispose(() => {
      unmount(ui);
    });
  }
}
