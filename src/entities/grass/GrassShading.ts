import {
  Fn,
  cameraPosition,
  float,
  mix,
  saturate,
  smoothstep,
  vec2,
  vec3,
} from "three/tsl";
import { type Node } from "three/webgpu";
import { lighting } from "../../systems";
import { config, uniforms } from "./config";

type GrassNormalInput = {
  clumpRadial: Node<"vec2">;
  height: Node<"float">;
  widthCoordinate: Node<"float">;
  viewSide: Node<"vec3">;
};

type GrassGroundInput = {
  albedo: Node<"vec3">;
  normal: Node<"vec3">;
  geometryNormal: Node<"vec3">;
  worldPosition: Node<"vec3">;
};

type GrassLightInput = {
  normal: Node<"vec3">;
  viewDirection: Node<"vec3">;
  viewDirectionXZ: Node<"vec2">;
};

type GrassSurfaceInput = {
  albedo: Node<"vec3">;
  occlusion: Node<"float">;
  height: Node<"float">;
  sceneLight: Node<"vec3">;
  skyFacing: Node<"float">;
  grazing: Node<"float">;
  backlight: Node<"float">;
  viewSunAlignment: Node<"float">;
};

const GROUND_HEIGHT = 0.7;
const GROUND_WIDTH_SAMPLES = [-1, 0, 1];

export const getGrassNoiseUv = (worldXZ: Node<"vec2">) =>
  worldXZ.div(config.TILE_SIZE).fract();

export const getGrassHeightFromMask = (grassMask: Node<"float">) =>
  grassMask.sub(0.25).div(0.75).clamp();

export const getGrassViewSide = (viewDirectionXZ: Node<"vec2">) =>
  vec3(viewDirectionXZ.y, 0, viewDirectionXZ.x.negate());

export const getGrassNormal = (input: GrassNormalInput) => {
  const { clumpRadial, height, widthCoordinate, viewSide } = input;
  const tuftRadial = clumpRadial.mul(uniforms.uTuftRoundness);
  const tuftNormal = vec3(tuftRadial.x, height.add(0.5), tuftRadial.y);
  const widthBend = widthCoordinate.mul(uniforms.uWidthRoundness);
  const widthNormal = viewSide.mul(widthBend);
  return tuftNormal.normalize().add(widthNormal).normalize();
};

export const getGrassColor = Fn<[positionNoise: Node<"float">], Node<"vec3">>(
  ([positionNoise]) => {
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

    return mix(
      mix(greenColor, uniforms.uRustColor, rustMask),
      uniforms.uWarmColor,
      warmMask,
    );
  },
);

export const getGrassAlbedo = (color: Node<"vec3">, height: Node<"float">) =>
  mix(
    color,
    uniforms.uTipColor,
    smoothstep(0.25, 1, height).mul(uniforms.uColorMixFactor),
  );

const getGrassSkyLight = (skyFacing: Node<"float">) => {
  const { uHemiGroundColor, uHemiSkyColor, uHemiIntensity } = lighting;
  const skyColor = mix(uHemiGroundColor, uHemiSkyColor, skyFacing);
  return skyColor.mul(uHemiIntensity).mul(uniforms.uLightExposure);
};

export const getGrassLight = (input: GrassLightInput) => {
  const { normal, viewDirection, viewDirectionXZ } = input;

  const signedNdotL = normal.dot(lighting.uSunDir.negate());

  const diffuseFacing = mix(0.65, signedNdotL.abs(), uniforms.uDiffuseContrast);

  const diffuseLight = mix(0.35, 1, diffuseFacing);
  const sunLight = lighting.uSunRadiance
    .mul(diffuseLight)
    .mul(uniforms.uLightExposure);

  const skyFacing = normal.y.mul(0.5).add(0.5);
  const sceneLight = getGrassSkyLight(skyFacing).add(sunLight);
  const viewFacing = normal.dot(viewDirection).abs().clamp();
  const grazing = float(1).sub(viewFacing);
  const backlight = saturate(signedNdotL.negate());
  const viewSunDot = viewDirectionXZ.dot(lighting.uSunDirXZ);
  const viewSunAlignment = viewSunDot.mul(0.5).add(0.5).clamp();

  return { sceneLight, skyFacing, grazing, backlight, viewSunAlignment };
};

export const shadeGrassSurface = (input: GrassSurfaceInput) => {
  const {
    albedo,
    occlusion,
    height,
    sceneLight,
    skyFacing,
    grazing,
    backlight,
    viewSunAlignment,
  } = input;

  const detailStrength = smoothstep(0.1, 0.9, height);

  const sheenAlignment = mix(0.25, 1, viewSunAlignment);
  const sheenStrength = grazing
    .mul(grazing)
    .mul(sheenAlignment)
    .mul(uniforms.uHighlightStrength)
    .mul(detailStrength);
  const sheen = lighting.uSunRadiance.mul(sheenStrength);

  const transmittedColor = mix(albedo, lighting.uSunColor, 0.55);
  const backlightResponse = mix(0.35, 1, backlight);
  const transmittedStrength = viewSunAlignment
    .mul(backlightResponse)
    .mul(uniforms.uBacklightStrength)
    .mul(detailStrength);
  const transmitted = transmittedColor.mul(transmittedStrength);

  const litAlbedo = albedo.mul(occlusion);
  const sunLight = sceneLight.sub(getGrassSkyLight(skyFacing));

  return {
    color: litAlbedo.mul(sceneLight).add(sheen).add(transmitted),
    directSun: litAlbedo.mul(sunLight).add(sheen).add(transmitted),
  };
};

export const shadeGrassGround = (input: GrassGroundInput) => {
  const { albedo, normal, geometryNormal, worldPosition } = input;
  const height = float(GROUND_HEIGHT);
  const viewOffset = cameraPosition.sub(worldPosition);
  const viewDirection = viewOffset.normalize();
  const viewDirectionXZ = viewOffset.xz.normalize();
  const viewSide = getGrassViewSide(viewDirectionXZ);

  let sceneLight: Node<"vec3"> = vec3(0);
  let skyFacing: Node<"float"> = float(0);
  let grazing: Node<"float"> = float(0);
  let backlight: Node<"float"> = float(0);
  let viewSunAlignment: Node<"float"> = float(0);
  for (const widthCoordinate of GROUND_WIDTH_SAMPLES) {
    const light = getGrassLight({
      normal: getGrassNormal({
        clumpRadial: vec2(0),
        height,
        widthCoordinate: float(widthCoordinate),
        viewSide,
      }),
      viewDirection,
      viewDirectionXZ,
    });
    sceneLight = sceneLight.add(light.sceneLight);
    skyFacing = skyFacing.add(light.skyFacing);
    grazing = grazing.add(light.grazing);
    backlight = backlight.add(light.backlight);
    viewSunAlignment = viewSunAlignment.add(light.viewSunAlignment);
  }
  const sampleWeight = 1 / GROUND_WIDTH_SAMPLES.length;

  const ground = shadeGrassSurface({
    albedo,
    occlusion: float(1),
    height,
    sceneLight: sceneLight.mul(sampleWeight),
    skyFacing: skyFacing.mul(sampleWeight),
    grazing: grazing.mul(sampleWeight),
    backlight: backlight.mul(sampleWeight),
    viewSunAlignment: viewSunAlignment.mul(sampleWeight),
  });

  const sunDirection = lighting.uSunDir.negate();
  const detailSunFacing = normal.dot(sunDirection).max(0);
  const surfaceSunFacing = geometryNormal.dot(sunDirection).max(0.05);
  const relief = detailSunFacing.div(surfaceSunFacing).clamp(0, 2);

  return {
    color: ground.color.mul(relief),
    directSun: ground.directSun.mul(relief),
  };
};
