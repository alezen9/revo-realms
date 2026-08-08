import { mount, unmount } from "svelte";
import UiRoot from "./index.svelte";

export const mountUi = () => {
  const ui = mount(UiRoot, { target: document.body });
  import.meta.hot?.dispose(() => unmount(ui));
};
