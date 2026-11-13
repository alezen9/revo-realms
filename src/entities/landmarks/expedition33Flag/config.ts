import { Color, Vector3 } from "three";
import { uniform } from "three/tsl";

const SEGMENTS_X = 24;
const SEGMENTS_Y = 16;
const POINTS_X = SEGMENTS_X + 1;
const POINTS_Y = SEGMENTS_Y + 1;
const COUNT = POINTS_X * POINTS_Y;
const SIM_DISTANCE = 80;
// one constraint pass per step, small steps converge faster than more passes
const STEPS_PER_SECOND = 960;
const WORKGROUP_SIZE = 256;

export const config = {
  SEGMENTS_X,
  SEGMENTS_Y,
  POINTS_X,
  POINTS_Y,
  COUNT,
  SIM_DISTANCE_SQUARED: SIM_DISTANCE * SIM_DISTANCE,
  STEP_SECONDS: 1 / STEPS_PER_SECOND,
  MAX_CATCH_UP_SECONDS: 1 / 30,
  MAX_SPEED: 18,
  TETHER_SLACK: 1.02,
  BEND_WEIGHT: 0.35,
  // the whole flag runs in one workgroup so every step stays in one dispatch
  WORKGROUP_SIZE,
  PARTICLES_PER_INVOCATION: Math.ceil(COUNT / WORKGROUP_SIZE),
};

export const uniforms = {
  uStepCount: uniform(0, "uint"),
  uDamping: uniform(2),
  uGravity: uniform(9.81),
  uStaffAxis: uniform(new Vector3(0, 1, 0)),
  // the flag's size and where its top edge meets the staff come from the model
  uFlagWidth: uniform(1),
  uFlagHeight: uniform(1),
  uAttachTop: uniform(1),
  uPlayerLocalPosition: uniform(new Vector3(0, -100, 0)),
  uPlayerRadius: uniform(0.5),
  uCollisionPadding: uniform(0.2),
  uWindStrength: uniform(0.15),
  uWindSpeed: uniform(6),
  uDrag: uniform(3),
  uLift: uniform(1.5),
  uGustStrength: uniform(0.5),
  uGustSpeed: uniform(0.1),
  uDiffuseScale: uniform(5),
  uEmissive: uniform(3),
};

const PETAL_COUNT = 96;
const PETAL_WORKGROUP_SIZE = 64;

export const petalConfig = {
  COUNT: PETAL_COUNT,
  WORKGROUP_SIZE: PETAL_WORKGROUP_SIZE,
  // petals peel off the outer part of the cloth, the staff side is held too tight
  MIN_SHED_WIDTH_RATIO: 0.55,
  MIN_LIFE_SECONDS: 6,
  MAX_LIFE_SECONDS: 9,
  GROW_END: 0.15,
  SHRINK_START: 0.35,
  MIN_SWAY_FREQUENCY: 1.2,
  MAX_SWAY_FREQUENCY: 2.2,
  // the farthest a full gust can carry a petal within its life
  REACH: 30,
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
