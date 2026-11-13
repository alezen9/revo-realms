import { Color } from "three";
import { uniform } from "three/tsl";

export const config = {
  GRASS_GROUND_SOFTNESS: 0.25,
};

export const uniforms = {
  uGrassGroundColor: uniform(new Color(0.25, 0.27, 0.18).convertSRGBToLinear()),
  uUnderwaterSandColor: uniform(
    new Color(0.95, 0.87, 0.68).convertSRGBToLinear(),
  ),
  uSandColor: uniform(new Color(0.89, 0.85, 0.75).convertSRGBToLinear()),
  uGrassNormalScale: uniform(1),
  uSandNormalScale: uniform(1),
  uWaterNormalScale: uniform(0.35),
  uCausticsHighlightScale: uniform(0.4),
  uCausticsUv1Scale: uniform(31.53),
  uCausticsUv2Scale: uniform(58.71),
};
