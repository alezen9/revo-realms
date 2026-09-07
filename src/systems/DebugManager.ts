import type {
  BindingParams,
  FolderApi,
  FolderParams,
  TpChangeEvent,
} from "tweakpane";
import { TOOLING_FLAGS } from "./runtime/ToolingFlags";

type BindingTarget = Parameters<FolderApi["addBinding"]>[0];
type ChangeHandler<T> = (event: TpChangeEvent<T>) => void;

type DebugBinding<T> = {
  on: (eventName: "change", handler: ChangeHandler<T>) => DebugBinding<T>;
};

export type DebugFolder = {
  addFolder: (params: FolderParams) => DebugFolder;
  addBinding: <T extends BindingTarget, K extends keyof T>(
    target: T,
    key: K,
    params?: BindingParams,
  ) => DebugBinding<T[K]>;
};

class DeadBinding<T> implements DebugBinding<T> {
  on = () => this;
}

class DeadFolder implements DebugFolder {
  addFolder = () => this;

  addBinding = <T extends BindingTarget, K extends keyof T>() =>
    new DeadBinding<T[K]>();
}

class PendingBinding<T> implements DebugBinding<T> {
  private handlers: ChangeHandler<T>[] = [];
  private binding?: DebugBinding<T>;

  on = (eventName: "change", handler: ChangeHandler<T>) => {
    const { binding } = this;
    if (binding) binding.on(eventName, handler);
    else this.handlers.push(handler);
    return this;
  };

  attach(binding: DebugBinding<T>) {
    this.binding = binding;
    for (const handler of this.handlers) binding.on("change", handler);
    this.handlers = [];
  }
}

class PendingFolder implements DebugFolder {
  private operations: ((folder: DebugFolder) => void)[] = [];
  private folder?: DebugFolder;

  addFolder = (params: FolderParams) => {
    const child = new PendingFolder();
    const { folder } = this;
    if (folder) child.attach(folder.addFolder(params));
    else this.operations.push((host) => child.attach(host.addFolder(params)));
    return child;
  };

  addBinding = <T extends BindingTarget, K extends keyof T>(
    target: T,
    key: K,
    params?: BindingParams,
  ) => {
    const binding = new PendingBinding<T[K]>();
    const { folder } = this;
    if (folder) binding.attach(folder.addBinding(target, key, params));
    else
      this.operations.push((host) =>
        binding.attach(host.addBinding(target, key, params)),
      );
    return binding;
  };

  attach(folder: DebugFolder) {
    this.folder = folder;
    for (const operation of this.operations) operation(folder);
    this.operations = [];
  }
}

export class DebugManager {
  private readonly pending = TOOLING_FLAGS.debug
    ? new PendingFolder()
    : undefined;

  readonly panel: DebugFolder = this.pending ?? new DeadFolder();

  async initAsync() {
    const { pending } = this;
    if (!pending) return;

    const { Pane } = await import("tweakpane");
    const pane = new Pane({ title: "Revo Realms" });
    pane.element?.parentElement?.classList.add("debug-panel");
    pending.attach(pane);
  }
}
