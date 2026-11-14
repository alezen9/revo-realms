import { uniform } from "three/tsl";

export const config = {
  SWAY_PHASE_PER_METER: 0.02,
};

export const uniforms = {
  uCanopyDiffuseScale: uniform(0.6),
  uCanopySwaySpeed: uniform(0.6),
  uBarkDiffuseScale: uniform(3.5),
  uBarkNormalScale: uniform(3),
  uBarkUvScale: uniform(3),
  uTrunkSwaySpeed: uniform(0.35),
  uTrunkSway: uniform(0.14),
  uGustLean: uniform(0.55),
};
