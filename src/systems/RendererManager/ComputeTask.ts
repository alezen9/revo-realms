import type { ComputeNode, WebGPURenderer } from "three/webgpu";

type ComputeTaskNodes = ComputeNode | ComputeNode[];

type ComputeTaskOptions = {
  label: string;
  renderer: WebGPURenderer;
  init?: ComputeTaskNodes;
  update: ComputeTaskNodes;
};

const setNodeNames = (nodes: ComputeTaskNodes | undefined, name: string) => {
  if (!nodes) return;
  const nodeList = Array.isArray(nodes) ? nodes : [nodes];
  for (const node of nodeList) {
    if (!node.name) node.name = name;
  }
};

export class ComputeTask {
  private label: string;
  private renderer: WebGPURenderer;
  private initNodes?: ComputeTaskNodes;
  private updateNodes: ComputeTaskNodes;
  private initPromise?: Promise<boolean>;
  private hasInitialized: boolean;

  constructor(options: ComputeTaskOptions) {
    this.label = options.label;
    this.renderer = options.renderer;
    this.initNodes = options.init;
    this.updateNodes = options.update;
    this.hasInitialized = !options.init;
    setNodeNames(this.initNodes, `${this.label} init`);
    setNodeNames(this.updateNodes, this.label);
  }

  get canUpdate() {
    return this.hasInitialized && !this.initPromise;
  }

  init() {
    if (this.hasInitialized) return Promise.resolve(true);
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.runInit();
    return this.initPromise;
  }

  update() {
    if (!this.canUpdate) return false;

    try {
      this.renderer.compute(this.updateNodes);
      return true;
    } catch (error) {
      console.error(`[${this.label}] compute update failed:`, error);
      return false;
    }
  }

  private async runInit() {
    try {
      if (!this.initNodes) return true;
      await this.renderer.computeAsync(this.initNodes);
      this.hasInitialized = true;
      return true;
    } catch (error) {
      console.error(`[${this.label}] compute init failed:`, error);
      return false;
    } finally {
      this.initPromise = undefined;
    }
  }
}
