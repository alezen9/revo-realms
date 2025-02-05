import {
  Color,
  DoubleSide,
  MeshBasicNodeMaterial,
  Texture,
} from "three/webgpu";
import {
  Fn,
  mix,
  positionGeometry,
  positionWorld,
  pow,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
} from "three/tsl";
import { assetManager } from "../systems/AssetManager";
import alphaTextureUrl from "/textures/test.jpg?url";

type UniformType<T> = ReturnType<typeof uniform<T>>;

type GrassUniforms = {
  uTime?: UniformType<number>;
  uWindSpeed?: UniformType<number>;
  uBladeNoiseScale?: UniformType<number>;
  uBaseColor?: UniformType<Color>;
  uTipColor?: UniformType<Color>;
};

const defaultUniforms: Required<GrassUniforms> = {
  uTime: uniform(0),
  uWindSpeed: uniform(0.025),
  uBladeNoiseScale: uniform(0.05),
  uBaseColor: uniform(new Color("#4f8a4f")),
  uTipColor: uniform(new Color("#f7ff3d")),
};

export default class GrassMaterial extends MeshBasicNodeMaterial {
  private _uniforms: Required<GrassUniforms>;
  private alphaTexture: Texture;

  constructor(uniforms: GrassUniforms) {
    super();
    this.alphaTexture = assetManager.textureLoader.load(alphaTextureUrl);
    this._uniforms = { ...defaultUniforms, ...uniforms };
    this.createGrassMaterial();
  }

  private computeDiffuseColor = Fn(() => {
    const factor = pow(uv().y, 1.5);
    const blendedColor = mix(
      this._uniforms.uBaseColor,
      this._uniforms.uTipColor,
      factor,
    );
    return blendedColor;
  });

  // private computeOpacity = Fn(() => {
  //   const bladeOrigin = vec2(positionWorld.x, positionWorld.z);

  //   const bladeUV = bladeOrigin.div(256);

  //   const sample = texture(this.alphaTexture, bladeUV).r;

  //   return sample;
  // });

  private createGrassMaterial() {
    this.precision = "lowp";
    this.side = DoubleSide;

    this.aoNode = smoothstep(-0.75, 1.25, uv().y);
    this.colorNode = this.computeDiffuseColor();
    // this.opacityNode = this.computeOpacity();
    // this.alphaTest = 0.1;
  }
}
