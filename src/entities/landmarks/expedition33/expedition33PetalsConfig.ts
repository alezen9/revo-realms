import { Color, Vector3 } from "three";
import { uniform } from "three/tsl";

const PETAL_COUNT = 96;
const PETAL_WORKGROUP_SIZE = 64;

export const petalConfig = {
  COUNT: PETAL_COUNT,
  WORKGROUP_SIZE: PETAL_WORKGROUP_SIZE,
  MIN_SHED_WIDTH_RATIO: 0.55,
  MIN_LIFE_SECONDS: 6,
  MAX_LIFE_SECONDS: 9,
  GROW_END: 0.15,
  SHRINK_START: 0.35,
  MIN_SWAY_FREQUENCY: 1.2,
  MAX_SWAY_FREQUENCY: 2.2,
  REACH: 30,
  MAX_STEP_SECONDS: 1 / 20,
};

export const petalUniforms = {
  uDelta: uniform(0),
  uFlagOrigin: uniform(new Vector3()),
  uInheritedSpeed: uniform(0.2),
  uWindSpeed: uniform(2.5),
  uFallSpeed: uniform(0.45),
  uSway: uniform(0.5),
  uSpin: uniform(1.2),
  uAirDrag: uniform(1.5),
  uSize: uniform(0.35),
  uRed: uniform(new Color(0.55, 0.02, 0.03)),
  uWhite: uniform(new Color(1, 1, 1)),
  uWhiteShare: uniform(1 / 6),
};
