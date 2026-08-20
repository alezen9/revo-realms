import type { PassLabelContext } from "agrimensor";
import type { Camera, RenderTarget, Scene } from "three";
import {
  InspectorBase,
  type ComputeNode,
  type WebGPURenderer,
} from "three/webgpu";

const getEncoderLabel = (uid: string, prefix: string) => {
  const segments = uid.split(":");
  const contextId = segments[2];
  if (!contextId) return;
  return `${prefix}_${contextId}`;
};

const getComputeLabel = (computeNodes: ComputeNode | ComputeNode[]) => {
  const nodeList = Array.isArray(computeNodes) ? computeNodes : [computeNodes];
  for (const node of nodeList) {
    if (node.name) return node.name;
  }
  return "Compute";
};

class PassLabelInspector extends InspectorBase {
  private passLabels: Map<string, string>;

  constructor(passLabels: Map<string, string>) {
    super();
    this.passLabels = passLabels;
  }

  beginRender(
    uid: string,
    scene: Scene,
    _camera: Camera,
    renderTarget: RenderTarget | null,
  ) {
    const encoderLabel = getEncoderLabel(uid, "renderContext");
    if (!encoderLabel) return;
    const passLabel = scene.name || renderTarget?.texture.name || "Render";
    this.passLabels.set(encoderLabel, passLabel);
  }

  beginCompute(uid: string, computeNodes: ComputeNode | ComputeNode[]) {
    const encoderLabel = getEncoderLabel(uid, "computeGroup");
    if (!encoderLabel) return;
    this.passLabels.set(encoderLabel, getComputeLabel(computeNodes));
  }
}

export class ThreeMonitoringAdapter {
  private renderer: WebGPURenderer;
  private passLabels = new Map<string, string>();
  private inspector = new PassLabelInspector(this.passLabels);
  private previousInspector: InspectorBase;
  private previousInfoAutoReset: boolean;

  constructor(renderer: WebGPURenderer) {
    this.renderer = renderer;
    this.previousInspector = renderer.inspector;
    this.previousInfoAutoReset = renderer.info.autoReset;
    renderer.inspector = this.inspector;
    renderer.info.autoReset = false;
  }

  consumePreviousFrameTriangles() {
    const { info } = this.renderer;
    const triangles = info.render.triangles;
    info.reset();
    return triangles;
  }

  resolvePassLabel = (pass: PassLabelContext) => {
    return this.passLabels.get(pass.label) ?? pass.label;
  };

  dispose() {
    if (this.renderer.inspector === this.inspector)
      this.renderer.inspector = this.previousInspector;
    this.renderer.info.autoReset = this.previousInfoAutoReset;
  }
}
