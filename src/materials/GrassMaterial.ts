import { Color, DoubleSide, MeshBasicNodeMaterial } from "three/webgpu";
import {
  cos,
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

type UniformType<T> = ReturnType<typeof uniform<T>>;

type GrassUniforms = {
  uTime?: UniformType<number>;
  uWindSpeed?: UniformType<number>;
  uBladeNoiseScale?: UniformType<number>;
  uDetailNoiseScale?: UniformType<number>;
  uNormalCurvatureAngle?: UniformType<number>;
  uBaseColor?: UniformType<Color>;
  uTipColor?: UniformType<Color>;
};

const defaultUniforms: Required<GrassUniforms> = {
  uTime: uniform(0),
  uWindSpeed: uniform(0.1),
  uBladeNoiseScale: uniform(0.05),
  uDetailNoiseScale: uniform(0.05),
  uNormalCurvatureAngle: uniform(0.75),
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

    colorFolder.addBinding(this._uniforms.uNormalCurvatureAngle, "value", {
      label: "Normal curvature",
      min: 0,
      max: 2,
    });
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

  // private computeCurvedNormal = Fn(() => {
  //   // remap to -1,1 range
  //   const sign = uv().x.sub(0.5).mul(2.0);
  //   // rotate based on the uv coordinate on the y axis
  //   // left and right edge outwards, central vertex doesnt rotate
  //   const curvedNormal = rotate(
  //     normalLocal,
  //     vec3(0, this._uniforms.uNormalCurvatureAngle.mul(sign), 0),
  //   );

  //   // Correct for Backface Rendering
  //   const curvedNormalAdjusted = mix(
  //     curvedNormal,
  //     curvedNormal.negate(),
  //     float(faceDirection.lessThan(0.0)),
  //   );

  //   return curvedNormalAdjusted;
  // });

  // private computeWindAnimation = Fn(() => {
  //   // 1. **Blade-Level Noise Sampling (With Seamless Wrapping)**
  //   const bladeOrigin = vec2(positionWorld.x, positionWorld.z);
  //   const bladeNoiseScale = 1.0; // or some value that gives a good range of UV variation
  //   const detailNoiseScale = 4.0; // Fine turbulence
  //   const timeFactor = this._uniforms.uTime.mul(this._uniforms.uWindSpeed); // Smooth time evolution

  //   // **Use fract to ensure UVs stay in [0, 1] for seamless looping**
  //   const bladeUV = fract(bladeOrigin.mul(bladeNoiseScale).add(timeFactor));
  //   const detailUV = fract(
  //     bladeOrigin.mul(detailNoiseScale).add(timeFactor.mul(1.5)),
  //   );

  //   // 2. **Sample Noise with Seamless Wrapping**
  //   const bladeWindSample = texture(assetManager.perlinNoiseTexture, bladeUV).r;
  //   const detailSample = texture(assetManager.perlinNoiseTexture, detailUV).r;

  //   // 3. **Blend Large and Small Scale Noise**
  //   const blendedWind = mix(bladeWindSample, detailSample, 0.3);

  //   // 4. **Smooth Wind Direction**
  //   const windAngle = blendedWind.mul(Math.PI * 2.0);
  //   const windDirection = normalize(vec2(cos(windAngle), sin(windAngle)));

  //   // 5. **Height-Based Bending for Natural Sway**
  //   const heightFactor = pow(uv().y, 2.0);
  //   const bendStrength = blendedWind.mul(0.3).mul(heightFactor);

  //   // 6. **Apply Consistent Bending to the Entire Blade**
  //   const bendOffset = vec3(windDirection.x, 0.0, windDirection.y).mul(
  //     bendStrength,
  //   );
  //   const bentPosition = positionWorld.add(bendOffset);
  //   return bentPosition;
  // });

  // private computeWindAnimation = Fn(() => {
  //   // 1. Compute a 2D position from the world X and Z coordinates.
  //   const bladePosXZ = vec2(positionWorld.x, positionWorld.z);

  //   // 3. Animate time evolution with a small factor
  //   const timeOffset = this._uniforms.uTime.mul(this._uniforms.uWindSpeed);

  //   // 4. Compute UVs for noise sampling using fract to ensure seamless tiling.
  //   const noiseUV1 = fract(
  //     bladePosXZ.mul(this._uniforms.uBladeNoiseScale).add(timeOffset),
  //   );
  //   const noiseUV2 = fract(
  //     bladePosXZ.mul(this._uniforms.uDetailNoiseScale).add(timeOffset.mul(1.5)),
  //   );

  //   // 5. Sample the noise texture. (Assumes the texture is set to wrap/repeat.)
  //   const noiseSample1 = texture(
  //     assetManager.perlinNoiseTexture,
  //     noiseUV1,
  //     0.5,
  //   ).r;
  //   const noiseSample2 = texture(
  //     assetManager.perlinNoiseTexture,
  //     noiseUV2,
  //     1.5,
  //   ).r;

  //   // 6. Blend the two noise samples to get a more organic, layered effect.
  //   const noiseValue = mix(noiseSample1, noiseSample2, 0.3);

  //   // 7. Use the noise value to determine a wind angle (0 to 2π) and convert to a 2D direction.
  //   const windAngle = noiseValue.mul(Math.PI * 2.0);
  //   const windDirection = normalize(vec2(cos(windAngle), sin(windAngle)));

  //   // 8. Modulate bending by the blade’s height (using uv().y).
  //   // Higher up on the blade means more bending.
  //   const heightInfluence = pow(uv().y, 2.0);
  //   const bendStrength = noiseValue.mul(0.3).mul(heightInfluence);

  //   // 9. Compute the offset vector in world space.
  //   const bendOffset = vec3(windDirection.x, 0.0, windDirection.y).mul(
  //     bendStrength,
  //   );

  //   // 10. Return the modified position.
  //   return positionWorld.add(bendOffset);
  // });

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

    const heightFactor = pow(positionGeometry.y.div(0.75), 2.0);
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

  private createGrassMaterial() {
    this.precision = "lowp";
    this.side = DoubleSide;

    this.aoNode = smoothstep(-0.75, 1.25, uv().y);
    this.colorNode = this.computeDiffuseColor();
    this.positionNode = this.computeWindAnimation();
  }
}
