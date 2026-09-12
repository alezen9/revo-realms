import {
  TWO_PI,
  cameraPosition,
  cos,
  float,
  hash,
  instanceIndex,
  mix,
  saturate,
  sin,
  smoothstep,
  uv,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import { SpriteNodeMaterial } from "three/webgpu";
import { lightingManager, shadowManager } from "../../../systems";
import { config, uniforms } from "./config";
import type { GrassCompute } from "./GrassCompute";
import {
  getBladeLocalOffset,
  getBend,
  getClumpRotation,
  getPositionNoise,
  getScale,
  getYOffset,
} from "./GrassBladeData";

export class GrassMaterial extends SpriteNodeMaterial {
  constructor(compute: GrassCompute) {
    super();

    this.transparent = false;
    this.stencilWrite = false;
    this.forceSinglePass = true;

    const bladeIndex = compute.visibleIndexBuffer.element(instanceIndex);
    const clumpIndex = bladeIndex.mod(config.CLUMP_COUNT);
    const bladeSlot = bladeIndex.div(config.CLUMP_COUNT);

    const clumpState = compute.clumpStateBuffer.element(clumpIndex);
    const bladeState = compute.bladeStateBuffer.element(bladeIndex);

    const clumpRotation = getClumpRotation(clumpState).toVar();

    const bladeLocalOffset = getBladeLocalOffset(
      bladeSlot,
      clumpRotation,
    ).toVar();

    const bladeOffsetX = clumpState.x.add(bladeLocalOffset.x);
    const bladeOffsetY = getYOffset(clumpState);
    const bladeOffsetZ = clumpState.y.add(bladeLocalOffset.y);

    const bendXZ = getBend(bladeState);
    const scaleY = getScale(bladeState);
    const positionNoise = getPositionNoise(bladeState);
    const groundShadowFactor = bladeState.z;

    const bladeUv = uv();
    const bladeHeight = bladeUv.y;
    const bladeHeightSquared = bladeHeight.mul(bladeHeight);
    const bladeHash = hash(bladeIndex);

    const playerDistanceSquared = bladeOffsetX
      .mul(bladeOffsetX)
      .add(bladeOffsetZ.mul(bladeOffsetZ));

    const worldPosition = vec3(
      bladeOffsetX.add(uniforms.uPlayerPosition.x),
      bladeOffsetY,
      bladeOffsetZ.add(uniforms.uPlayerPosition.z),
    );

    // WIDTH
    const widthDistanceFactor = smoothstep(
      uniforms.uWidthNearRadiusSquared,
      uniforms.uWidthFarRadiusSquared,
      playerDistanceSquared,
    );

    const distanceWidthGain = mix(
      1,
      uniforms.uWidthFarGain,
      widthDistanceFactor,
    );

    const bladeWidth = uniforms.uBladeWidth.mul(distanceWidthGain);

    const bladeWidthScale = positionNoise.add(0.5).mul(bladeWidth);

    this.scaleNode = vec3(bladeWidthScale, scaleY, 1);

    // ROTATION
    const randomBendOffset = bladeHash.mul(0.25).sub(0.125);

    const spriteRotationNoise = bladeHash.mul(31.7).fract().mul(2).sub(1);

    const spriteRotation = spriteRotationNoise.mul(
      uniforms.uSpriteRotationRandomness,
    );

    const bendProfile = bladeHeightSquared.mul(uniforms.uBaseBending);

    const positionBendOffset = positionNoise.sub(0.5).mul(0.25);

    const baseBending = positionBendOffset
      .add(randomBendOffset)
      .mul(bendProfile);

    this.rotationNode = spriteRotation.add(baseBending);

    // POSITION / BEND
    const bendLengthSquared = bendXZ.dot(bendXZ);

    const bendDrop = bendLengthSquared
      .div(scaleY.mul(config.BLADE_HEIGHT * 2))
      .mul(uniforms.uBendDropStrength);

    const bendControlShape = bladeHeight
      .mul(float(1).sub(bladeHeight))
      .mul(uniforms.uBendControlPoint.mul(2));

    const bendShape = bendControlShape.add(bladeHeightSquared);

    const bendOffset = vec3(bendXZ.x, bendDrop.negate(), bendXZ.y).mul(
      bendShape,
    );

    this.positionNode = vec3(bladeOffsetX, bladeOffsetY, bladeOffsetZ).add(
      bendOffset,
    );

    // NEAR DETAIL / AO
    const nearDetailMask = float(1).sub(
      smoothstep(0, uniforms.uAoRadiusSquared, playerDistanceSquared),
    );

    const nearDetailOcclusionValue = uniforms.uAoScale
      .mul(0.25)
      .mul(nearDetailMask);

    // COLOR
    const colorVariation = mix(
      1,
      positionNoise,
      uniforms.uColorVariationStrength,
    );

    const greenColor = mix(
      uniforms.uBaseColorDark,
      uniforms.uBaseColor,
      colorVariation,
    );

    const rustMask = positionNoise
      .mul(float(1).sub(positionNoise))
      .mul(4)
      .mul(uniforms.uRustVariationStrength);

    const warmMask = positionNoise
      .sub(0.6)
      .mul(2.5)
      .clamp()
      .mul(uniforms.uWarmVariationStrength);

    const variedColor = mix(
      mix(greenColor, uniforms.uRustColor, rustMask),
      uniforms.uWarmColor,
      warmMask,
    );

    // LIGHTING
    const lightingAngle = bladeHash.mul(53.3).fract().mul(TWO_PI);

    const lightingNormal = vec3(cos(lightingAngle), 0, sin(lightingAngle));

    const lightDirection = lightingManager.uSunDir.negate();

    const viewOffset = cameraPosition.sub(worldPosition);
    const viewDirection = viewOffset.normalize();
    const viewDirectionXZ = viewOffset.xz.normalize();

    const signedNdotL = lightingNormal.dot(lightDirection);

    const twoSidedNdotL = signedNdotL.abs();

    const grazing = float(1).sub(
      lightingNormal.dot(viewDirection).abs().clamp(),
    );

    const backlight = saturate(signedNdotL.negate());

    const viewSunAlignment = viewDirectionXZ
      .dot(lightingManager.uSunDirXZ)
      .mul(0.5)
      .add(0.5)
      .clamp();

    const diffuseFacing = mix(0.65, twoSidedNdotL, uniforms.uDiffuseContrast);

    const sunDiffuse = lightingManager.uSunRadiance.mul(
      mix(0.35, 1, diffuseFacing),
    );

    const hemisphereLight = mix(
      lightingManager.uHemiGroundColor,
      lightingManager.uHemiSkyColor,
      bladeHeight.mul(0.5),
    ).mul(lightingManager.uHemiIntensity);

    // PACK VARYINGS
    const colorShadow = varying(vec4(variedColor, groundShadowFactor));

    const lightingGrazing = varying(vec4(sunDiffuse, grazing));

    const viewLightingDetail = varying(
      vec3(backlight, viewSunAlignment, nearDetailOcclusionValue),
    );

    const bladeColor = colorShadow.rgb;
    const shadowMultiplier = shadowManager.getMultiplier(colorShadow.a);

    const sceneLighting = hemisphereLight
      .add(lightingGrazing.rgb.mul(shadowMultiplier))
      .mul(uniforms.uLightExposure);
    const bladeGrazing = lightingGrazing.a;

    const bladeBacklight = viewLightingDetail.x;
    const bladeViewSunAlignment = viewLightingDetail.y;
    const nearDetailOcclusion = viewLightingDetail.z;

    // FRAGMENT DETAIL
    const bladeEdgeDistance = bladeUv.x.mul(2).sub(1).abs();

    const edgeOcclusionMask = smoothstep(
      uniforms.uAoRimSmoothness.negate(),
      uniforms.uAoRimSmoothness,
      bladeEdgeDistance,
    );

    const rootOcclusionMask = float(1).sub(smoothstep(0.1, 0.85, bladeHeight));

    const occlusionAmount = nearDetailOcclusion
      .mul(edgeOcclusionMask)
      .mul(rootOcclusionMask);

    const detailOcclusion = float(1).sub(occlusionAmount);

    const tipColorFactor = smoothstep(0.25, 1, bladeHeight).mul(
      uniforms.uColorMixFactor,
    );

    const albedo = mix(bladeColor, uniforms.uTipColor, tipColorFactor);

    // SHEEN / TRANSMISSION
    const grazingSheen = bladeGrazing
      .mul(bladeGrazing)
      .mul(mix(0.25, 1, bladeViewSunAlignment))
      .mul(uniforms.uHighlightStrength);

    const transmission = bladeViewSunAlignment
      .mul(mix(0.35, 1, bladeBacklight))
      .mul(uniforms.uBacklightStrength);

    const detailStrength = smoothstep(0.1, 0.9, bladeHeight).mul(
      shadowMultiplier,
    );

    const diffuseColor = albedo.mul(detailOcclusion).mul(sceneLighting);

    const sheenColor = lightingManager.uSunRadiance.rgb
      .mul(detailStrength)
      .mul(grazingSheen);

    const transmittedColor = mix(albedo, lightingManager.uSunColor, 0.55).mul(
      detailStrength.mul(transmission),
    );

    const shadedColor = diffuseColor.add(sheenColor).add(transmittedColor);

    // LOD DEBUG
    const lodIndex = instanceIndex.div(config.BLADE_COUNT);

    const lodDebugColor = uniforms.uLodDebugColors.element(lodIndex);

    this.colorNode = mix(shadedColor, lodDebugColor, uniforms.uLodDebugEnabled);
  }
}
