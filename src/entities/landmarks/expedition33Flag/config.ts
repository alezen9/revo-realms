import { Vector3 } from "three";
import { uniform } from "three/tsl";

const SEGMENTS_X = 24;
const SEGMENTS_Y = 16;
const POINTS_X = SEGMENTS_X + 1;
const POINTS_Y = SEGMENTS_Y + 1;
const COUNT = POINTS_X * POINTS_Y;
const FLAG_WIDTH = 5.4;
const FLAG_HEIGHT = 3.3;
const STAFF_HEIGHT = 6.5;
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
  REST_X: FLAG_WIDTH / SEGMENTS_X,
  REST_Y: FLAG_HEIGHT / SEGMENTS_Y,
  FLAG_WIDTH,
  FLAG_HEIGHT,
  STAFF_HEIGHT,
  STAFF_RADIUS: 0.07,
  STAFF_LEAN_RADIANS: (8 * Math.PI) / 180,
  ATTACH_TOP: STAFF_HEIGHT - 0.2,
  SIM_DISTANCE_SQUARED: SIM_DISTANCE * SIM_DISTANCE,
  STEP_SECONDS: 1 / STEPS_PER_SECOND,
  MAX_CATCH_UP_SECONDS: 1 / 30,
  MAX_SPEED: 18,
  TETHER_SLACK: 1.02,
  // the bounds readback lands a few frames late, the cloth can move this much meanwhile
  BOUNDS_MARGIN: 0.5,
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
  uPlayerLocalPosition: uniform(new Vector3(0, -100, 0)),
  uPlayerRadius: uniform(0.5),
  uCollisionPadding: uniform(0.2),
  uWindStrength: uniform(0.15),
  uWindForce: uniform(45),
  uGustStrength: uniform(0.5),
  uGustSpeed: uniform(0.1),
  uFlutter: uniform(3),
  uDiffuseScale: uniform(8),
  uEmissive: uniform(15),
};
