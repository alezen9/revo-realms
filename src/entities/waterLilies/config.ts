import { uniform } from "three/tsl";
import { Color, Vector3 } from "three";

export const config = {
  PADS: ["lily-pad-1", "lily-pad-2", "lily-pad-3"],
  MAX_LILIES_PER_CLUSTER: 3,
  FIRST_SIZE: { min: 2.6, max: 3.8 },
  COMPANION_SIZE: { min: 1.3, max: 2.6 },
  COMPANION_GAP: 0.15,
  FLOAT_HEIGHT: 0.04,
  PUSH_RADIUS: 2.4,
  PUSH_SPEED: 1.2,
  DIP_RADIUS: 1.6,
  PRESS_RATE: 4,
  MAX_PRESS_HEIGHT: 1.2,
  ACTIVE_MARGIN: 20,
  BOB_SPEED: 1.3,
  SEED: 7,
};

export const uniforms = {
  uTint: uniform(new Color(0.51, 0.64, 0.55)),
  uDiffuseScale: uniform(5),
  uRoughness: uniform(0.35),
  uNormalScale: uniform(0.8),
  uBob: uniform(0.012),
  uDipDepth: uniform(0.3),
  uPlayerPosition: uniform(new Vector3()),
  uPlayerPress: uniform(0),
};
