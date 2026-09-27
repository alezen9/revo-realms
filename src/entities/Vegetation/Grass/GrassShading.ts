import { Fn, float, mix, saturate, smoothstep } from "three/tsl";
import { type Node } from "three/webgpu";
import { lightingManager } from "../../../systems";
import { config, uniforms } from "./config";

type GrassLightInput = {
  normal: Node<"vec3">;
  viewDirection: Node<"vec3">;
  viewDirectionXZ: Node<"vec2">;
  height: Node<"float">;
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

export const getGrassNoiseUv = (worldXZ: Node<"vec2">) =>
  worldXZ.div(config.TILE_SIZE).fract();

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

const getGrassSkyLight = (skyFacing: Node<"float">) =>
  mix(
    lightingManager.uHemiGroundColor,
    lightingManager.uHemiSkyColor,
    skyFacing,
  )
    .mul(lightingManager.uHemiIntensity)
    .mul(uniforms.uLightExposure);

export const getGrassLight = (input: GrassLightInput) => {
  const { normal, viewDirection, viewDirectionXZ, height } = input;

  const signedNdotL = normal.dot(lightingManager.uSunDir.negate());

  const diffuseFacing = mix(0.65, signedNdotL.abs(), uniforms.uDiffuseContrast);

  const sunLight = lightingManager.uSunRadiance
    .mul(mix(0.35, 1, diffuseFacing))
    .mul(uniforms.uLightExposure);

  const skyFacing = mix(
    height.mul(0.5),
    normal.y.mul(0.5).add(0.5),
    uniforms.uFluffiness,
  );

  return {
    sceneLight: getGrassSkyLight(skyFacing).add(sunLight),
    skyFacing,
    grazing: float(1).sub(normal.dot(viewDirection).abs().clamp()),
    backlight: saturate(signedNdotL.negate()),
    viewSunAlignment: viewDirectionXZ
      .dot(lightingManager.uSunDirXZ)
      .mul(0.5)
      .add(0.5)
      .clamp(),
  };
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

  const sheen = lightingManager.uSunRadiance.mul(
    grazing
      .mul(grazing)
      .mul(mix(0.25, 1, viewSunAlignment))
      .mul(uniforms.uHighlightStrength)
      .mul(detailStrength),
  );

  const transmitted = mix(albedo, lightingManager.uSunColor, 0.55).mul(
    viewSunAlignment
      .mul(mix(0.35, 1, backlight))
      .mul(uniforms.uBacklightStrength)
      .mul(detailStrength),
  );

  const litAlbedo = albedo.mul(occlusion);
  const sunLight = sceneLight.sub(getGrassSkyLight(skyFacing));

  return {
    color: litAlbedo.mul(sceneLight).add(sheen).add(transmitted),
    directSun: litAlbedo.mul(sunLight).add(sheen).add(transmitted),
  };
};
