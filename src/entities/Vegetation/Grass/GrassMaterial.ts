import {
  TWO_PI,
  cameraPosition,
  cos,
  float,
  hash,
  instanceIndex,
  mix,
  mrt,
  sin,
  smoothstep,
  uv,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import { SpriteNodeMaterial } from "three/webgpu";
import { config, uniforms } from "./config";
import type { GrassCompute } from "./GrassCompute";
import {
  getGrassAlbedo,
  getGrassColor,
  getGrassLight,
  shadeGrassSurface,
} from "./GrassShading";
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
    const variedColor = getGrassColor(positionNoise);

    // LIGHTING
    const lightingAngle = bladeHash.mul(53.3).fract().mul(TWO_PI);

    const flatNormal = vec3(cos(lightingAngle), 0, sin(lightingAngle));

    const viewOffset = cameraPosition.sub(worldPosition);
    const viewDirection = viewOffset.normalize();
    const viewDirectionXZ = viewOffset.xz.normalize();

    const clumpRadial = bladeLocalOffset.div(config.CLUMP_LOCAL_RADIUS);

    const domeNormal = vec3(
      clumpRadial.x.mul(uniforms.uTuftRoundness),
      bladeHeight.add(0.5),
      clumpRadial.y.mul(uniforms.uTuftRoundness),
    ).normalize();

    const viewSide = vec3(viewDirectionXZ.y, 0, viewDirectionXZ.x.negate());

    const widthCoordinate = bladeUv.x.mul(2).sub(1);

    const roundedNormal = domeNormal
      .add(viewSide.mul(widthCoordinate.mul(uniforms.uWidthRoundness)))
      .normalize();

    const lightingNormal = mix(
      flatNormal,
      roundedNormal,
      uniforms.uFluffiness,
    ).normalize();

    const light = getGrassLight({
      normal: lightingNormal,
      viewDirection,
      viewDirectionXZ,
      height: bladeHeight,
    });

    // PACK VARYINGS
    const bladeSurface = varying(
      vec4(variedColor, scaleY.div(uniforms.uBladeMaxScale).clamp()),
    );
    const bladeColor = bladeSurface.rgb;

    const lightingGrazing = varying(vec4(light.sceneLight, light.grazing));

    const viewLightingDetail = varying(
      vec4(
        light.backlight,
        light.viewSunAlignment,
        nearDetailOcclusionValue,
        light.skyFacing,
      ),
    );

    const sceneLighting = lightingGrazing.rgb;
    const bladeGrazing = lightingGrazing.a;

    const bladeBacklight = viewLightingDetail.x;
    const bladeViewSunAlignment = viewLightingDetail.y;
    const nearDetailOcclusion = viewLightingDetail.z;
    const bladeSkyFacing = viewLightingDetail.w;

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

    const shaded = shadeGrassSurface({
      albedo: getGrassAlbedo(bladeColor, bladeHeight),
      occlusion: detailOcclusion,
      height: bladeHeight,
      sceneLight: sceneLighting,
      skyFacing: bladeSkyFacing,
      grazing: bladeGrazing,
      backlight: bladeBacklight,
      viewSunAlignment: bladeViewSunAlignment,
    });

    this.mrtNode = mrt({
      directSun: vec4(
        mix(shaded.directSun, vec3(0), uniforms.uLodDebugEnabled),
        1,
      ),
      softShadow: vec4(bladeSurface.a),
    });

    // LOD DEBUG
    const lodIndex = instanceIndex.div(config.BLADE_COUNT);

    const lodDebugColor = uniforms.uLodDebugColors.element(lodIndex);

    this.colorNode = mix(
      shaded.color,
      lodDebugColor,
      uniforms.uLodDebugEnabled,
    );
  }
}
