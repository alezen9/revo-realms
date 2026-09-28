import type { Camera, DepthTexture, Scene } from "three";
import {
  NodeFrame,
  RedFormat,
  RGBFormat,
  UnsignedByteType,
  UnsignedInt101111Type,
  type PassNode,
  type Renderer,
  type TextureNode,
  type WebGPURenderer,
} from "three/webgpu";
import { mrt, output, pass, texture, vec4 } from "three/tsl";

export const SCENE_PASS_SAMPLES = 4;

export class ScenePass {
  readonly output: TextureNode;
  readonly directSun: TextureNode;
  readonly softShadow: TextureNode;
  readonly depth: TextureNode;
  readonly depthTexture: DepthTexture;
  private passNode: PassNode;
  private frame = new NodeFrame();

  constructor(renderer: WebGPURenderer, scene: Scene, camera: Camera) {
    this.passNode = pass(scene, camera, { samples: SCENE_PASS_SAMPLES });
    this.passNode.name = "Main scene";
    this.passNode.setMRT(
      mrt({ output, directSun: vec4(0), softShadow: vec4(0) }),
    );
    this.frame.renderer = renderer;

    const directSunTexture = this.passNode.getTexture("directSun");
    directSunTexture.format = RGBFormat;
    directSunTexture.type = UnsignedInt101111Type;
    const softShadowTexture = this.passNode.getTexture("softShadow");
    softShadowTexture.format = RedFormat;
    softShadowTexture.type = UnsignedByteType;
    const depthTexture = this.passNode.renderTarget.depthTexture;
    if (!depthTexture) throw new Error("Shadows require scene depth");
    depthTexture.renderTarget = this.passNode.renderTarget;

    this.output = texture(this.passNode.getTexture("output"));
    this.directSun = texture(directSunTexture);
    this.softShadow = texture(softShadowTexture);
    this.depth = texture(depthTexture);
    this.depthTexture = depthTexture;
  }

  setCamera(camera: Camera) {
    this.passNode.camera = camera;
    this.passNode.needsUpdate = true;
  }

  compileAsync(renderer: Renderer) {
    return this.passNode.compileAsync(renderer);
  }

  render() {
    this.passNode.updateBefore(this.frame);
  }
}
