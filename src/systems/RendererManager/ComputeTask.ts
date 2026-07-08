import type { ComputeNode, WebGPURenderer } from "three/webgpu";

type ComputeTaskNodes = ComputeNode | ComputeNode[];

type ComputeTaskOptions = {
  label: string;
  renderer: WebGPURenderer;
  init?: ComputeTaskNodes;
  update: ComputeTaskNodes;
};

export class ComputeTask {
  private label: string;
  private renderer: WebGPURenderer;
  private initNodes?: ComputeTaskNodes;
  private updateNodes: ComputeTaskNodes;
  private initPromise?: Promise<void>;
  private updatePromise?: Promise<void>;
  private hasInitialized: boolean;

  constructor(options: ComputeTaskOptions) {
    this.label = options.label;
    this.renderer = options.renderer;
    this.initNodes = options.init;
    this.updateNodes = options.update;
    this.hasInitialized = !options.init;
  }

  get canUpdate() {
    return this.hasInitialized && !this.initPromise && !this.updatePromise;
  }

  init() {
    if (!this.initNodes || this.hasInitialized || this.initPromise)
      return this.initPromise;

    this.initPromise = this.runInit();
    return this.initPromise;
  }

  update() {
    if (!this.canUpdate) return;

    this.updatePromise = this.runUpdate();
    return this.updatePromise;
  }

  private async runInit() {
    try {
      if (!this.initNodes) return;
      await this.renderer.computeAsync(this.initNodes);
      this.hasInitialized = true;
    } catch (error) {
      console.error(`[${this.label}] compute init failed:`, error);
    } finally {
      this.initPromise = undefined;
    }
  }

  private async runUpdate() {
    try {
      await this.renderer.computeAsync(this.updateNodes);
    } catch (error) {
      console.error(`[${this.label}] compute update failed:`, error);
      throw error;
    } finally {
      this.updatePromise = undefined;
    }
  }
}
