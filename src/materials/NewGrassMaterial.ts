import { Color, DoubleSide, MeshBasicNodeMaterial } from "three/webgpu";
import { Fn, mix, pow, smoothstep, uniform, uv } from "three/tsl";
import { State } from "../Game";

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

  constructor(uniforms: GrassUniforms) {
    super();
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

  private createGrassMaterial() {
    this.precision = "lowp";
    this.side = DoubleSide;

    this.aoNode = smoothstep(-0.75, 1.25, uv().y);
    this.colorNode = this.computeDiffuseColor();
  }

  update(state: State) {}
}
