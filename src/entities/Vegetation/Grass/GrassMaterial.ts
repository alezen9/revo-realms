import {
  PI2,
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
} from "three/tsl";
import { SpriteNodeMaterial } from "three/webgpu";
import { lightingManager } from "../../../systems";
import { config, uniforms } from "./config";
import type { GrassCompute } from "./GrassCompute";
import {
  getBakedShadowFactor,
  getBend,
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
    const lodIndex = instanceIndex.div(config.COUNT);
    const bladeState = compute.bladeStateBuffer.element(bladeIndex);
    const bladeTerrain = compute.bladeTerrainBuffer.element(bladeIndex);
    const offsetX = bladeState.x;
    const offsetY = getYOffset(bladeTerrain);
    const offsetZ = bladeState.y;
    const bendXZ = getBend(bladeState);
    const scaleY = getScale(bladeState);
    const positionNoise = getPositionNoise(bladeTerrain);
    const bakedShadowFactor = getBakedShadowFactor(bladeTerrain);
    const bladeUv = uv();
    const bladeHeight = bladeUv.y;
    const bladeHash = hash(bladeIndex);
    const distanceSquared = offsetX.mul(offsetX).add(offsetZ.mul(offsetZ));
    const worldPosition = vec3(
      offsetX.add(uniforms.uPlayerPosition.x),
      offsetY,
      offsetZ.add(uniforms.uPlayerPosition.z),
    );

    const farWidthBlend = smoothstep(
      uniforms.uWidthNearRadiusSquared,
      uniforms.uWidthFarRadiusSquared,
      distanceSquared,
    );
    const farWidthGain = mix(1, uniforms.uWidthFarGain, farWidthBlend);
    const bladeWidth = uniforms.uBladeWidth.mul(farWidthGain);
    const widthVariation = positionNoise.add(0.5);
    this.scaleNode = vec3(widthVariation.mul(bladeWidth), scaleY, 1);

    const instanceNoise = bladeHash.mul(0.25).sub(0.125);
    const spriteNoise = bladeHash.mul(31.7).fract().mul(2).sub(1);
    const spriteRotation = spriteNoise.mul(uniforms.uSpriteRotationRandomness);
    const bendWeight = bladeHeight.mul(bladeHeight);
    const bendProfile = bendWeight.mul(uniforms.uBaseBending);
    const baseBending = positionNoise
      .sub(0.5)
      .mul(0.25)
      .add(instanceNoise)
      .mul(bendProfile);
    this.rotationNode = spriteRotation.add(baseBending);

    const bendDrop = bendXZ
      .dot(bendXZ)
      .div(scaleY.mul(config.BLADE_HEIGHT * 2))
      .mul(uniforms.uBendDropStrength);
    const bendShape = uniforms.uBendControlPoint
      .mul(2)
      .mul(bladeHeight)
      .mul(float(1).sub(bladeHeight))
      .add(bendWeight);
    const bendOffset = vec3(bendXZ.x, bendDrop.negate(), bendXZ.y).mul(
      bendShape,
    );
    const finalPosition = vec3(offsetX, offsetY, offsetZ).add(bendOffset);
    this.positionNode = finalPosition;

    const proximityMask = float(1).sub(
      smoothstep(0, uniforms.uAoRadiusSquared, distanceSquared),
    );
    const proximityOcclusion = varying(
      uniforms.uAoScale.mul(0.25).mul(proximityMask),
    );
    const edgeDistance = bladeUv.x.mul(2).sub(1).abs();
    const edgeMask = smoothstep(
      uniforms.uAoRimSmoothness.negate(),
      uniforms.uAoRimSmoothness,
      edgeDistance,
    );
    const rootMask = float(1).sub(smoothstep(0.1, 0.85, bladeHeight));
    const occlusion = float(1).sub(
      proximityOcclusion.mul(edgeMask).mul(rootMask),
    );
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
    const bladeColor = varying(
      mix(
        mix(greenColor, uniforms.uRustColor, rustMask),
        uniforms.uWarmColor,
        warmMask,
      ),
    );
    const shadow = varying(
      mix(lightingManager.uBakedShadowBrightness, 1, bakedShadowFactor),
    );
    const albedo = mix(
      bladeColor,
      uniforms.uTipColor,
      smoothstep(0.25, 1, bladeHeight).mul(uniforms.uColorMixFactor),
    );

    const bladeAngle = bladeHash.mul(53.3).fract().mul(PI2);
    const restingNormal = vec3(cos(bladeAngle), 0, sin(bladeAngle));
    const lightDirection = lightingManager.uSunDir.negate();
    const viewDirection = cameraPosition.sub(worldPosition).normalize();
    const twoSidedNdotL = restingNormal.dot(lightDirection).abs();
    const grazing = float(1).sub(
      restingNormal.dot(viewDirection).abs().clamp(),
    );
    const localBacklight = saturate(restingNormal.dot(lightDirection).negate());
    const viewSunAlignment = viewDirection.xz
      .normalize()
      .dot(lightingManager.uSunDir.xz.normalize())
      .mul(0.5)
      .add(0.5)
      .clamp();

    const diffuseFacing = mix(0.65, twoSidedNdotL, uniforms.uDiffuseContrast);
    const sunDiffuse = lightingManager.uSunRadiance.mul(
      mix(0.35, 1, diffuseFacing),
    );
    const skyVisibility = mix(uniforms.uRootSkyVisibility, 1, bladeHeight);
    const hemiWeight = skyVisibility.mul(0.5);
    const hemisphereLight = mix(
      lightingManager.uHemiGroundColor,
      lightingManager.uHemiSkyColor,
      hemiWeight,
    ).mul(lightingManager.uHemiIntensity);
    const sceneLighting = varying(
      hemisphereLight.add(sunDiffuse).mul(uniforms.uLightExposure),
    );
    const bladeGrazing = varying(grazing);
    const bladeBacklight = varying(localBacklight);
    const bladeViewSunAlignment = varying(viewSunAlignment);
    const grazingSheen = bladeGrazing
      .mul(bladeGrazing)
      .mul(mix(0.25, 1, bladeViewSunAlignment))
      .mul(uniforms.uHighlightStrength);
    const transmission = bladeViewSunAlignment
      .mul(mix(0.35, 1, bladeBacklight))
      .mul(uniforms.uBacklightStrength);
    const detailStrength = smoothstep(0.1, 0.9, bladeHeight).mul(shadow);
    const diffuseColor = albedo.mul(shadow).mul(occlusion).mul(sceneLighting);
    const sheenColor = lightingManager.uSunRadiance.mul(
      grazingSheen.mul(detailStrength),
    );
    const transmittedColor = mix(albedo, lightingManager.uSunColor, 0.55).mul(
      transmission.mul(detailStrength),
    );
    const shadedColor = diffuseColor.add(sheenColor).add(transmittedColor);
    const lodDebugColor = uniforms.uLodDebugColors.element(lodIndex);
    this.colorNode = mix(shadedColor, lodDebugColor, uniforms.uLodDebugEnabled);
  }
}
