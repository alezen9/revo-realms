import {
  PI2,
  cos,
  float,
  hash,
  instanceIndex,
  mix,
  sin,
  smoothstep,
  uv,
  varying,
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

    // SSBO
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

    // Common
    const bladeUv = uv();
    const h = bladeUv.y;
    const bend = h.mul(h);

    const bladeHash = hash(bladeIndex);
    const instanceNoise = bladeHash.mul(0.25).sub(0.125);
    const spriteNoise = bladeHash.mul(31.7).fract().mul(2).sub(1);

    // Visibility
    this.opacityNode = varying(isVisible);

    // Scale
    const scaleX = positionNoise.add(0.5);

    this.scaleNode = vec3(scaleX, scaleY, 1).mul(isVisible);

    const scaleWindFactor = mix(
      0.25,
      1,
      smoothstep(uniforms.uBladeMinScale, uniforms.uBladeMaxScale, scaleY),
    );

    // Rotation
    const spriteRotation = spriteNoise.mul(uniforms.uSpriteRotationRandomness);

    const bendProfile = bend.mul(uniforms.uBaseBending);

    const baseBending = positionNoise
      .sub(0.5)
      .mul(0.25)
      .add(instanceNoise)
      .mul(bendProfile);

    this.rotationNode = spriteRotation.add(baseBending);

    // Position
    const bladePosition = vec3(offsetX, offsetY, offsetZ);

    // Ambient sway
    const swayRate = spriteNoise.remap(-1, 1, 0.7, 1.45);
    const randomPhase = instanceNoise.mul(25.13);

    const swayEnvelope = mix(0.75, 1.35, windNoiseFactor);

    const heightPhase = bend.mul(0.55).mul(swayEnvelope);

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

    const swayAmount = swayA
      .add(swayB)
      .mul(uniforms.uAmbientSwayStrength)
      .mul(swayEnvelope);

    const ambientAngle = bladeHash.mul(53.3).fract().mul(PI2);

    const ambientDirection = vec2(cos(ambientAngle), sin(ambientAngle));

    const ambientOffset = vec3(ambientDirection.x, 0, ambientDirection.y).mul(
      swayAmount.mul(bend),
    );

    // Directional wind
    const windOffset = vec3(windXZ.x, 0, windXZ.y).mul(
      bendProfile.mul(scaleWindFactor),
    );

    // Wind flutter
    const windDirection = windManager.uDirection;

    const perpendicularWind = vec2(windDirection.y.negate(), windDirection.x);

    const flutterPhase = bladeHash
      .mul(97.13)
      .fract()
      .mul(PI2)
      .add(offsetX.mul(0.13))
      .add(offsetZ.mul(0.07));

    const flutter = sin(
      gameTime
        .mul(uniforms.uWindSpeed.mul(1.7))
        .add(flutterPhase.mul(1.3))
        .add(heightPhase.mul(2.2)),
    )
      .mul(0.025)
      .mul(windNoiseFactor)
      .mul(bendProfile)
      .mul(scaleWindFactor);

    const flutterOffset = vec3(perpendicularWind.x, 0, perpendicularWind.y).mul(
      flutter,
    );

    this.positionNode = bladePosition
      .add(ambientOffset)
      .add(flutterOffset)
      .add(windOffset);

    // AO
    const distanceSquared = offsetX.mul(offsetX).add(offsetZ.mul(offsetZ));

    const nearAo = float(1).sub(
      smoothstep(0, uniforms.uAoRadiusSquared, distanceSquared),
    );

    const aoStrength = varying(uniforms.uAoScale.mul(0.25).mul(nearAo));

    const edge = bladeUv.x.mul(2).sub(1).abs();

    const edgeMask = smoothstep(
      uniforms.uAoRimSmoothness.negate(),
      uniforms.uAoRimSmoothness,
      edge,
    );

    const rootMask = float(1).sub(smoothstep(0.1, 0.85, h));

    const ao = float(1).sub(aoStrength.mul(edgeMask).mul(rootMask));

    // Color variation
    const colorVariation = smoothstep(
      0,
      uniforms.uColorVariationStrength,
      positionNoise,
    );

    const bladeColor = varying(
      mix(uniforms.uBaseColorDark, uniforms.uBaseColor, colorVariation),
    );

    // Baked shadow
    const shadow = varying(
      mix(lightingManager.uBakedShadowBrightness, 1, bakedShadowFactor),
    );

    // Base -> tip
    const baseToTip = mix(
      bladeColor,
      uniforms.uTipColor,
      h.mul(uniforms.uColorMixFactor),
    );

    this.colorNode = baseToTip.mul(shadow.mul(ao));
  }
}
