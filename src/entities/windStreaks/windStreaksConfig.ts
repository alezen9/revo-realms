import { Color, Vector3 } from "three/webgpu";
import { uniform } from "three/tsl";

const STREAK_COUNT = 12;
const SEGMENT_COUNT = 24;
const SPINE_POINT_COUNT = SEGMENT_COUNT + 1;
const FIELD_HALF_SIZE = 60;
const TRAIL_LENGTH = 24;

export const config = {
  STREAK_COUNT,
  SEGMENT_COUNT,
  SPINE_POINT_COUNT,
  FIELD_HALF_SIZE,
  TRAIL_LENGTH,
  TOTAL_SPINE_POINT_COUNT: STREAK_COUNT * SPINE_POINT_COUNT,
  RECYCLE_DISTANCE: FIELD_HALF_SIZE + TRAIL_LENGTH,
  EDGE_FADE_SIZE: 18,
  FORWARD_BIAS: 25,
  STREAK_SPEED: 18,
  GROUND_CLEARANCE: 0.16,
  HEIGHT_FOLLOW_RATE: 2.5,
  SPAWN_FADE_DISTANCE: 12,
  GOLDEN_RATIO_CONJUGATE: (Math.sqrt(5) - 1) / 2,
  HEIGHT_SEQUENCE_STEP: Math.SQRT2 - 1,
  MAX_UPDATE_DELTA: 0.1,
  STREAK_WORKGROUP_SIZE: 16,
};

export const uniforms = {
  uPlayerPosition: uniform(new Vector3()),
  uDelta: uniform(0),
  uReset: uniform(1),
  uColor: uniform(new Color().setRGB(0.42, 0.47, 0.43)),
  uSpeed: uniform(1.5),
  uHeight: uniform(10),
  uWidth: uniform(0.2),
  uCurveAmplitude: uniform(3.2),
  uCurveWavelength: uniform(48),
};
