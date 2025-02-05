import { Color, DoubleSide, MeshBasicNodeMaterial } from "three/webgpu";
import {
  cos,
  float,
  Fn,
  fract,
  mix,
  normalize,
  positionGeometry,
  positionWorld,
  pow,
  sin,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import { FolderApi } from "tweakpane";
import { debugManager } from "../systems/DebugManager";
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
  private debugFolder: FolderApi;
  constructor(uniforms: GrassUniforms, enableDebug = true) {
    super();
    this._uniforms = { ...defaultUniforms, ...uniforms };
    this.createGrassMaterial();
    this.debugFolder = debugManager.panel.addFolder({ title: "🌱 Grass" });
    this.debugFolder.hidden = !enableDebug;
    if (!enableDebug) return;
    this.debugColor();
    this.debugAnimation();
  }

  private debugAnimation() {
    const animationFolder = this.debugFolder.addFolder({ title: "Animation" });

    animationFolder.addBinding(this._uniforms.uWindSpeed, "value", {
      label: "Wind speed",
      min: 0.01,
      max: 0.1,
      step: 0.01,
    });
  }

  private debugColor() {
    const colorFolder = this.debugFolder.addFolder({ title: "Color" });

    colorFolder.addBinding(this._uniforms.uBaseColor, "value", {
      label: "Base Color",
      view: "color",
      color: { type: "float" },
    });
    colorFolder.addBinding(this._uniforms.uTipColor, "value", {
      label: "Tip Color",
      view: "color",
      color: { type: "float" },
    });
  }

  private computeWindAnimation = Fn(() => {
    const bladeOrigin = vec2(positionWorld.x, positionWorld.z);
    const timer = this._uniforms.uTime.mul(this._uniforms.uWindSpeed); // Smooth time evolution

    const bladeUV = fract(
      bladeOrigin.mul(this._uniforms.uBladeNoiseScale).add(timer),
    );

    const noiseSample = texture(
      assetManager.perlinNoiseTexture,
      bladeUV,
      0.5,
    ).r;

    const windAngle = noiseSample.mul(Math.PI * 2.0);
    const windDirection = normalize(vec2(cos(windAngle), sin(windAngle)));

    const y = positionGeometry.y.div(0.75);
    const heightFactor = y.mul(y);
    const bendStrength = noiseSample.mul(0.3).mul(heightFactor);

    const bendOffset = vec3(windDirection.x, 0.0, windDirection.y).mul(
      bendStrength,
    );
    const bentPosition = positionWorld.add(bendOffset);

    return bentPosition;
  });

  private computeDiffuseColor = Fn(() => {
    const factor = pow(positionGeometry.y, 1.5); // try uv().y
    const blendedColor = mix(
      this._uniforms.uBaseColor,
      this._uniforms.uTipColor,
      factor,
    );
    return blendedColor;
  });

  private computeOpacity = Fn(() => {
    // const alphamap = assetManager.textureLoader.load(alphaTextureUrl);
    const alphamap = assetManager.perlinNoiseTexture;
    const bladeOrigin = vec2(positionWorld.x, positionWorld.z);

    const bladeUV = bladeOrigin.div(256);

    const sample = texture(alphamap, bladeUV, 1).r;

    return sample;
  });

  private createGrassMaterial() {
    this.precision = "lowp";
    this.side = DoubleSide;

    this.aoNode = smoothstep(-0.75, 1.25, uv().y);
    // this.opacityNode = this.computeOpacity();
    this.colorNode = this.computeDiffuseColor();
    // this.alphaTest = 0.5;
  }
}
