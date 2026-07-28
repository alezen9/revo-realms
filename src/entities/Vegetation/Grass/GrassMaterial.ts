import {
  PI2,
  cos,
  float,
  hash,
  instanceIndex,
  mix,
  pow,
  sin,
  smoothstep,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import { SpriteNodeMaterial } from "three/webgpu";
import { lightingManager, windManager } from "../../../systems";
import { gameTime } from "../../../utils/GameTime";
import { uniforms } from "./config";
import { GrassSsbo } from "./GrassSsbo";

export class GrassMaterial extends SpriteNodeMaterial {
  private ssbo: GrassSsbo;

  constructor(ssbo: GrassSsbo) {
    super();
    this.ssbo = ssbo;
    this.createGrassMaterial();
  }

  private createGrassMaterial() {
    this.precision = "lowp";
    this.transparent = false;
    this.stencilWrite = false;
    this.forceSinglePass = true;

    // compute values
    const bladeIndex = this.ssbo.visibleIndexBuffer.element(instanceIndex);
    const data1 = this.ssbo.computeBuffer1.element(bladeIndex);
    const data2 = this.ssbo.computeBuffer2.element(bladeIndex);
    const offsetX = data1.x;
    const offsetY = this.ssbo.getYOffset(data2);
    const offsetZ = data1.y;
    const windXZ = this.ssbo.getWind(data1);
    const scaleY = this.ssbo.getScale(data1);
    const isVisible = this.ssbo.getVisibility(data1);
    const windNoiseFactor = this.ssbo.getWindNoise(data1);
    const positionNoise = this.ssbo.getPositionNoise(data2);
    const bakedShadowFactor = this.ssbo.getBakedShadowFactor(data2);

    // OPACITY
    this.opacityNode = isVisible;

    // SCALE
    const scaleX = positionNoise.remap(0, 1, 0.5, 1.5);
    const bladeScale = vec3(scaleX, scaleY, 1);
    const visibleScale = mix(vec3(0), bladeScale, isVisible);
    this.scaleNode = visibleScale;
    const scaleWindFactor = mix(
      0.25,
      1.0,
      smoothstep(uniforms.uBladeMinScale, uniforms.uBladeMaxScale, scaleY),
    );

    // ROTATION
    const instanceNoise = hash(bladeIndex.add(196.4356)).sub(0.5).mul(0.25);
    const spriteNoise = hash(bladeIndex.add(284.7821)).sub(0.5).mul(2);
    const spriteRotation = spriteNoise.mul(uniforms.uSpriteRotationRandomness);
    const h = uv().y;
    const bendProfile = h.mul(h).mul(uniforms.uBaseBending);
    const baseBending = positionNoise
      .sub(0.5)
      .mul(0.25)
      .add(instanceNoise)
      .mul(bendProfile);
    const rotation = spriteRotation.add(baseBending);
    this.rotationNode = rotation;

    // POSITION
    // base offset
    const bladePosition = vec3(offsetX, offsetY, offsetZ);
    // sway effect
    const swayRate = spriteNoise.remap(-1, 1, 0.7, 1.45);
    const randomPhase = instanceNoise.mul(25.13);
    const heightPhase = h
      .mul(h)
      .mul(0.55)
      .mul(mix(0.75, 1.35, windNoiseFactor));
    const swayA = sin(
      gameTime.mul(swayRate.mul(1.35)).add(randomPhase).add(heightPhase),
    );
    const swayB = sin(
      gameTime
        .mul(swayRate.mul(2.15))
        .add(offsetX.mul(0.17))
        .add(offsetZ.mul(0.11))
        .add(randomPhase.mul(1.7))
        .add(heightPhase.mul(1.6)),
    ).mul(0.45);
    const swayEnvelope = mix(0.75, 1.35, windNoiseFactor);
    const swayAmount = swayA
      .add(swayB)
      .mul(uniforms.uAmbientSwayStrength)
      .mul(swayEnvelope);
    const swayFactor = uv().y.mul(uv().y);
    const ambientAngle = hash(bladeIndex.add(71.17)).mul(PI2);
    const ambientDir = vec2(cos(ambientAngle), sin(ambientAngle));
    const swayOffset = vec3(ambientDir.x, 0, ambientDir.y).mul(
      swayAmount.mul(swayFactor),
    );
    // flutter offset
    const dirXZ = windManager.uDirection;
    const perp = vec2(dirXZ.y.negate(), dirXZ.x);
    const phase = hash(bladeIndex)
      .mul(PI2)
      .add(offsetX.mul(0.13))
      .add(offsetZ.mul(0.07));
    const flutter = sin(
      gameTime
        .mul(uniforms.uWindSpeed.mul(1.7))
        .add(phase.mul(1.3))
        .add(heightPhase.mul(2.2)),
    )
      .mul(0.025)
      .mul(windNoiseFactor)
      .mul(bendProfile)
      .mul(scaleWindFactor);
    const flutterOffset = vec3(perp.x, 0.0, perp.y).mul(flutter);
    // wind offset
    const windOffset = vec3(windXZ.x, 0, windXZ.y).mul(
      bendProfile.mul(scaleWindFactor),
    );

    const pos = bladePosition
      .add(swayOffset)
      .add(flutterOffset)
      .add(windOffset);
    this.positionNode = pos;

    // COLOR + AO
    // ao
    const r2 = offsetX.mul(offsetX).add(offsetZ.mul(offsetZ));
    const near = float(1).sub(smoothstep(0, uniforms.uAoRadiusSquared, r2));
    const edge = uv().x.mul(2.0).sub(1.0).abs();
    const rim = smoothstep(
      uniforms.uAoRimSmoothness.negate(),
      uniforms.uAoRimSmoothness,
      edge,
    );
    const hWeight = float(1).sub(smoothstep(0.1, 0.85, h));
    const aoStrength = uniforms.uAoScale.mul(0.25);
    const ao = float(1).sub(aoStrength.mul(near.mul(rim).mul(hWeight)));
    // diffuse
    const colorProfile = h.mul(uniforms.uColorMixFactor);
    const jitter = smoothstep(
      0,
      uniforms.uColorVariationStrength,
      positionNoise,
    );
    const baseColorJittered = uniforms.uBaseColor.mul(jitter);
    const baseToTip = mix(baseColorJittered, uniforms.uTipColor, colorProfile);
    const withShadow = mix(
      baseToTip.mul(lightingManager.uBakedShadowBrightness),
      baseToTip,
      bakedShadowFactor,
    );

    this.colorNode = withShadow.mul(ao);
  }
}
