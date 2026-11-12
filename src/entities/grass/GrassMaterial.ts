import {
  cameraPosition,
  float,
  hash,
  instanceIndex,
  inverseSqrt,
  mix,
  mrt,
  sin,
  smoothstep,
  uv,
  varying,
  vec2,
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
  getGrassNormal,
  getGrassViewSide,
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

    const bladeIndex = compute.visibleIndices.element(instanceIndex);
    const clumpIndex = bladeIndex.mod(config.CLUMP_COUNT);
    const bladeSlot = bladeIndex.div(config.CLUMP_COUNT);

    const clumpState = compute.clumpState.element(clumpIndex);
    const bladeState = compute.bladeState.element(bladeIndex);

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

    const bladeWidthScale = mix(0.6, 1.6, bladeHash).mul(bladeWidth);

    this.scaleNode = vec3(bladeWidthScale, scaleY, 1);

    const spriteRotationNoise = bladeHash.mul(31.7).fract().mul(2).sub(1);

    const spriteRotation = spriteRotationNoise.mul(
      uniforms.uSpriteRotationRandomness,
    );

    const bendVariation = positionNoise.add(bladeHash).sub(1).mul(0.25);
    const baseBending = bendVariation
      .mul(uniforms.uBaseBending)
      .mul(bladeHeightSquared);

    this.rotationNode = spriteRotation.add(baseBending);

    const clumpRadial = bladeLocalOffset.div(config.CLUMP_LOCAL_RADIUS);
    const tuftSpread = clumpRadial.mul(uniforms.uTuftSpread).mul(scaleY);

    const bladeLength = scaleY.mul(config.BLADE_HEIGHT);
    const maxLean = bladeLength.mul(config.MAX_LEAN_PER_BLADE_LENGTH);
    const swirlPhase = worldPosition.xz.mul(config.SWIRLS_PER_METER);
    const swirl = vec2(
      sin(swirlPhase.x.add(sin(swirlPhase.y.mul(0.6)).mul(2))),
      sin(swirlPhase.y.mul(0.9).add(sin(swirlPhase.x.mul(0.5)).mul(2))),
    );
    const patchLean = swirl.mul(uniforms.uPatchLean);
    const droopDirection = vec2(
      bladeHash.mul(73.1).fract(),
      bladeHash.mul(19.7).fract(),
    ).sub(0.5);
    const bladeDroop = droopDirection
      .mul(droopDirection.length())
      .mul(uniforms.uBladeDroop);
    const restLean = tuftSpread.add(patchLean.add(bladeDroop).mul(scaleY));
    const pushXZ = bendXZ.add(restLean);
    const pushPerMaxLeanSquared = pushXZ.dot(pushXZ).div(maxLean.mul(maxLean));
    const leanLimit = inverseSqrt(pushPerMaxLeanSquared.add(1));
    const leanXZ = pushXZ.mul(leanLimit);
    const leanLengthSquared = leanXZ.dot(leanXZ);

    const bendDrop = leanLengthSquared
      .div(bladeLength.mul(2))
      .mul(uniforms.uBendDropStrength);

    const heightArc = bladeHeight.mul(float(1).sub(bladeHeight));
    const controlStrength = uniforms.uBendControlPoint.mul(2);
    const bendControlShape = heightArc.mul(controlStrength);

    const bendShape = bendControlShape.add(bladeHeightSquared);

    const bendOffset = vec3(leanXZ.x, bendDrop.negate(), leanXZ.y).mul(
      bendShape,
    );

    this.positionNode = vec3(bladeOffsetX, bladeOffsetY, bladeOffsetZ).add(
      bendOffset,
    );

    const nearDetailMask = float(1).sub(
      smoothstep(0, uniforms.uAoRadiusSquared, playerDistanceSquared),
    );

    const nearDetailOcclusionValue = uniforms.uAoScale
      .mul(0.25)
      .mul(nearDetailMask);

    const variedColor = getGrassColor(positionNoise);

    const viewOffset = cameraPosition.sub(worldPosition);
    const viewDirection = viewOffset.normalize();
    const viewDirectionXZ = viewOffset.xz.normalize();

    const bladeTone = bladeHash
      .mul(57.3)
      .fract()
      .sub(0.5)
      .mul(uniforms.uBladeToneVariation)
      .add(1);

    const windLean = bendXZ.mul(leanLimit).mul(bendShape);
    const faceExposure = float(1)
      .sub(windLean.dot(viewDirectionXZ).mul(uniforms.uWindExposure))
      .clamp(0.5, 1.5);

    const light = getGrassLight({
      normal: getGrassNormal({
        clumpRadial,
        height: bladeHeight,
        widthCoordinate: bladeUv.x.mul(2).sub(1),
        viewSide: getGrassViewSide(viewDirectionXZ),
      }),
      viewDirection,
      viewDirectionXZ,
    });

    const bladeSurface = varying(
      vec4(
        variedColor.mul(faceExposure).mul(bladeTone),
        scaleY.div(uniforms.uBladeMaxScale).clamp(),
      ),
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

    const lodIndex = instanceIndex.div(config.BLADE_COUNT);

    const lodDebugColor = uniforms.uLodDebugColors.element(lodIndex);

    this.colorNode = mix(
      shaded.color,
      lodDebugColor,
      uniforms.uLodDebugEnabled,
    );
  }
}
