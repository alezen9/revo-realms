import { Color, DoubleSide, MeshLambertNodeMaterial } from "three/webgpu";
import { Fn, mix, pow, smoothstep, uniform, uv } from "three/tsl";

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

export default class GrassMaterial extends MeshLambertNodeMaterial {
  private _uniforms: Required<GrassUniforms>;

  constructor(uniforms: GrassUniforms) {
    super();
    this._uniforms = { ...defaultUniforms, ...uniforms };
    this.createGrassMaterial();
  }

  // private computeWindAnimation = Fn(() => {
  //   const bladeOrigin = vec2(positionWorld.x, positionWorld.z);

  //   const timer = this.uTime.mul(0.01);

  //   const bladeUV = mod(bladeOrigin.mul(0.05).add(timer), 1);
  //   const noiseSample = texture(
  //     assetManager.perlinNoiseTexture,
  //     bladeUV.mul(2),
  //     2,
  //   ).r;

  //   const windAngle = noiseSample.mul(Math.PI * 0.1);
  //   const windDir = normalize(vec2(cos(windAngle), sin(windAngle)));

  //   const y = positionLocal.y.div(float(0.75));
  //   const heightFactor = y.mul(y);
  //   const bendStrength = noiseSample.mul(float(0.3)).mul(heightFactor);

  //   const bendOffset = vec3(windDir.x, 0.0, windDir.y).mul(bendStrength);

  //   return positionWorld.add(bendOffset);
  // });

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
}
