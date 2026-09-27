import { HalfFloatType, Vector2 } from "three";
import {
  NodeMaterial,
  QuadMesh,
  RenderTarget,
  type Node,
  type WebGPURenderer,
} from "three/webgpu";
import { texture } from "three/tsl";

export class TexturePass {
  readonly size = new Vector2(1, 1);
  private renderer: WebGPURenderer;
  private scale: number;
  private renderTarget = new RenderTarget(1, 1, {
    type: HalfFloatType,
    depthBuffer: false,
  });
  private material = new NodeMaterial();
  private quad = new QuadMesh(this.material);
  private drawingBufferSize = new Vector2();

  constructor(renderer: WebGPURenderer, name: string, scale = 1) {
    this.renderer = renderer;
    this.scale = scale;
    this.renderTarget.texture.name = name;
    this.material.name = name;
    this.quad.name = name;
  }

  apply(color: Node<"vec4">) {
    this.material.fragmentNode = color;
    this.material.needsUpdate = true;
    return texture(this.renderTarget.texture);
  }

  render() {
    this.renderer.getDrawingBufferSize(this.drawingBufferSize);
    const width = Math.max(
      1,
      Math.floor(this.drawingBufferSize.x * this.scale),
    );
    const height = Math.max(
      1,
      Math.floor(this.drawingBufferSize.y * this.scale),
    );
    this.renderTarget.setSize(width, height);
    this.size.set(width, height);
    const previousRenderTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.renderTarget);
    this.quad.render(this.renderer);
    this.renderer.setRenderTarget(previousRenderTarget);
  }
}
