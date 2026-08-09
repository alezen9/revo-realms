import {
  PI2,
  cameraPosition,
  cos,
  float,
  hash,
  instanceIndex,
  mix,
  modelWorldMatrix,
  saturate,
  sin,
  smoothstep,
  uv,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import { SpriteNodeMaterial } from "three/webgpu";
import { lightingManager } from "../../../systems";
import { uniforms } from "./config";
import { GrassCompute } from "./GrassCompute";

export class GrassMaterial extends SpriteNodeMaterial {
  private compute: GrassCompute;

  constructor(compute: GrassCompute) {
    super();

    this.compute = compute;
    this.createGrassMaterial();
  }

  private createGrassMaterial() {
    this.precision = "lowp";
    this.transparent = false;
    this.stencilWrite = false;
    this.forceSinglePass = true;

    const bladeIndex = this.compute.visibleIndexBuffer.element(instanceIndex);
    const bladeState = this.compute.bladeStateBuffer.element(bladeIndex);
    const bladeTerrain = this.compute.bladeTerrainBuffer.element(bladeIndex);

    const offsetX = bladeState.x;
    const offsetY = this.compute.getYOffset(bladeTerrain);
    const offsetZ = bladeState.y;

    const bendXZ = this.compute.getBend(bladeState);
    const scaleY = this.compute.getScale(bladeState);
    const isVisible = this.compute.getVisibility(bladeState);
    const positionNoise = this.compute.getPositionNoise(bladeTerrain);
    const bakedShadowFactor = this.compute.getBakedShadowFactor(bladeTerrain);

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

    // Rotation
    const spriteRotation = spriteNoise.mul(uniforms.uSpriteRotationRandomness);

    const bendProfile = bend.mul(uniforms.uBaseBending);

    const baseBending = positionNoise
      .sub(0.5)
      .mul(0.25)
      .add(instanceNoise)
      .mul(bendProfile);

    this.rotationNode = spriteRotation.add(baseBending);

    const bladePosition = vec3(offsetX, offsetY, offsetZ);
    const bendOffset = vec3(bendXZ.x, 0, bendXZ.y).mul(bend);
    const finalPosition = bladePosition.add(bendOffset);
    this.positionNode = finalPosition;

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
    const colorNoise = smoothstep(0.1, 0.9, positionNoise);
    const colorVariation = mix(1, colorNoise, uniforms.uColorVariationStrength);

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
      smoothstep(0.25, 1, h).mul(uniforms.uColorMixFactor),
    );

    const bladeAngle = bladeHash.mul(53.3).fract().mul(PI2);
    const restingNormal = vec3(cos(bladeAngle), 0, sin(bladeAngle));
    const bladeTangent = vec3(
      bendXZ.x.mul(h).mul(1.8),
      1,
      bendXZ.y.mul(h).mul(1.8),
    ).normalize();
    const normalProjection = bladeTangent.mul(restingNormal.dot(bladeTangent));
    const bladeNormal = varying(
      restingNormal.sub(normalProjection).normalize(),
    );

    const nearLighting = varying(
      float(1).sub(smoothstep(20 * 20, 45 * 45, distanceSquared)),
    );
    const lightDirection = lightingManager.uSunDir.negate();
    const twoSidedNdotL = bladeNormal.dot(lightDirection).abs();
    const diffuseFacing = mix(
      0.65,
      twoSidedNdotL,
      nearLighting.mul(uniforms.uDiffuseContrast),
    );
    const sunDiffuse = lightingManager.uSunColor
      .mul(lightingManager.uSunIntensity)
      .mul(mix(0.35, 1, diffuseFacing));

    const hemiWeight = bladeNormal.y.mul(0.5).add(0.5).clamp();
    const hemisphereLight = mix(
      lightingManager.uHemiGroundColor,
      lightingManager.uHemiSkyColor,
      hemiWeight,
    ).mul(lightingManager.uHemiIntensity);

    const sceneLight = hemisphereLight
      .add(sunDiffuse)
      .mul(uniforms.uLightExposure);

    const worldPosition = modelWorldMatrix.mul(vec4(finalPosition, 1)).xyz;
    const viewDirection = varying(
      cameraPosition.sub(worldPosition).normalize(),
    );
    const viewDirectionXZ = viewDirection.xz.normalize();
    const lookingTowardSun = viewDirectionXZ
      .dot(lightingManager.uSunDir.xz.normalize())
      .mul(0.5)
      .add(0.5)
      .clamp();

    const grazing = float(1).sub(bladeNormal.dot(viewDirection).abs().clamp());
    const grazingSheen = grazing
      .mul(grazing)
      .mul(mix(0.25, 1, lookingTowardSun))
      .mul(uniforms.uHighlightStrength);
    const localBacklight = saturate(bladeNormal.dot(lightDirection).negate());
    const transmission = lookingTowardSun
      .mul(mix(0.35, 1, localBacklight))
      .mul(uniforms.uBacklightStrength);
    const highlightHeight = smoothstep(0.1, 0.9, h);
    const lightingDetail = nearLighting.mul(highlightHeight).mul(shadow);

    const diffuseColor = baseToTip.mul(shadow).mul(ao).mul(sceneLight);
    const sheenColor = lightingManager.uSunColor
      .mul(lightingManager.uSunIntensity)
      .mul(grazingSheen.mul(lightingDetail));
    const transmittedColor = mix(
      baseToTip,
      lightingManager.uSunColor,
      0.55,
    ).mul(transmission.mul(lightingDetail));

    this.colorNode = diffuseColor.add(sheenColor).add(transmittedColor);
  }
}
