import type { Camera, Scene } from "three";
import {
  NodeFrame,
  type Node,
  type PassNode,
  type Renderer,
  type TextureNode,
  type WebGPURenderer,
} from "three/webgpu";
import { mix, pass, screenUV, texture, vec4 } from "three/tsl";

export class WaterPass {
  private passNode: PassNode;
  private water: TextureNode;
  private frame = new NodeFrame();

  constructor(renderer: WebGPURenderer, scene: Scene, camera: Camera) {
    this.passNode = pass(scene, camera, { samples: 0, depthBuffer: false });
    this.passNode.name = "Water";
    this.water = texture(this.passNode.getTexture("output"));
    this.frame.renderer = renderer;
  }

  setCamera(camera: Camera) {
    this.passNode.camera = camera;
    this.passNode.needsUpdate = true;
  }

  apply(sceneColor: Node<"vec4">) {
    const water = this.water.sample(screenUV);
    return mix(sceneColor, vec4(water.rgb, 1), water.a);
  }

  compileAsync(renderer: Renderer) {
    return this.passNode.compileAsync(renderer);
  }

  render() {
    this.passNode.updateBefore(this.frame);
  }
}
