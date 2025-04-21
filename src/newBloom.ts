import {
  HalfFloatType,
  RenderTarget,
  Vector2,
  TempNode,
  QuadMesh,
  NodeMaterial,
  RendererUtils,
  NodeUpdateType,
  WebGPURenderer,
  LinearMipmapLinearFilter,
  LinearFilter,
} from "three/webgpu";

import { Fn, uv, passTexture, uniform, texture } from "three/tsl";

const _quadMesh = new QuadMesh();
const _size = new Vector2();
let _rendererState: any;

class BloomNode extends TempNode {
  static get type(): string {
    return "BloomNode";
  }

  inputNode: any;
  strength: any;
  _renderTargetBright: RenderTarget;
  _textureNodeBright: any;
  _textureOutput: any;
  _compositeMaterial: NodeMaterial | null;
  updateBeforeType = NodeUpdateType.FRAME;

  constructor(inputNode: any, strength = 1) {
    super("vec4");

    this.inputNode = inputNode;
    this.strength = uniform(strength);

    this._renderTargetBright = new RenderTarget(1, 1, {
      depthBuffer: false,
      type: HalfFloatType,
      generateMipmaps: true,
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
    });

    this._renderTargetBright.texture.name = "BloomMip.Bright";

    this._textureNodeBright = texture(this._renderTargetBright.texture);
    this._textureOutput = passTexture(this, this._renderTargetBright.texture);
    this._compositeMaterial = null;
  }

  getTextureNode() {
    return this._textureOutput;
  }

  setSize(width: number, height: number): void {
    const resx = Math.round(width / 2);
    const resy = Math.round(height / 2);
    this._renderTargetBright.setSize(resx, resy);
  }

  updateBefore(frame: any): void {
    const { renderer } = frame;

    _rendererState = RendererUtils.resetRendererState(
      renderer as WebGPURenderer,
      _rendererState,
    );

    const size = renderer.getDrawingBufferSize(_size);
    this.setSize(size.width, size.height);

    // Render base level
    renderer.setRenderTarget(this._renderTargetBright);
    _quadMesh.material = this._compositeMaterial!;
    _quadMesh.render(renderer);

    // 🔥 Now generate mipmaps for it
    // renderer.updateRenderTargetMipmap(this._renderTargetBright);

    RendererUtils.restoreRendererState(
      renderer as WebGPURenderer,
      _rendererState,
    );
  }

  setup(builder: any) {
    const tex = this._textureNodeBright;
    const uvNode = uv();

    const bloomPass = Fn(() => {
      const mip0 = tex.sample(uvNode, 2);
      const mip1 = tex.sample(uvNode, 4);
      const mip2 = tex.sample(uvNode, 6);

      //   const bloom = mip0.mul(0.6).add(mip1.mul(0.3)).add(mip2.mul(0.1));
      //   return bloom.mul(this.strength);
      const bloom = tex.sample(uv()).mul(this.strength);
      return bloom;
    });

    this._compositeMaterial = new NodeMaterial();
    this._compositeMaterial.fragmentNode = bloomPass().context(
      builder.getSharedContext(),
    );
    this._compositeMaterial.name = "BloomMip_composite";
    this._compositeMaterial.needsUpdate = true;

    return this._textureOutput;
  }

  dispose(): void {
    this._renderTargetBright.dispose();
  }
}

export const bloom = (node: any, strength?: number): BloomNode =>
  new BloomNode(node, strength);

export default BloomNode;
