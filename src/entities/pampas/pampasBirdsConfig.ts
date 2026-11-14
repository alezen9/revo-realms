import { Color, Vector3 } from "three";
import { uniform } from "three/tsl";

export const birdConfig = {
  COUNT: 128,
  WORKGROUP_SIZE: 64,
  MAX_LIFE_SECONDS: 20,
  MIN_OFFSCREEN_SECONDS: 1,
  MIN_COOLDOWN_SECONDS: 30,
  MAX_COOLDOWN_SECONDS: 120,
  MAX_BIRDS_PER_CLUMP: 2,
  FLUSH_RADIUS: 3,
  FLUSH_HEIGHT: 0.8,
  FLUSH_SPREAD: 0.6,
  FLUSH_ALONG_PLAYER: 0.5,
  BURST_SPEED: 13,
  CRUISE_SPEED: 10,
  SETTLE_SECONDS: 1.5,
  RISE_SECONDS: 0.9,
  MIN_CLIMB_SPEED: 2,
  MAX_CLIMB_SPEED: 3.5,
  MAX_TURN_RATE: 0.45,
  FLAP_RATE: 38,
  FLAP_ANGLE: 0.95,
  GROW_SECONDS: 0.15,
  MAX_STEP_SECONDS: 1 / 20,
};

export const birdUniforms = {
  uDelta: uniform(0),
  uPlayerVelocity: uniform(new Vector3()),
  uMinSize: uniform(0.2),
  uMaxSize: uniform(0.45),
  uColor: uniform(new Color(1, 0.72, 0.28).convertSRGBToLinear()),
  uSecondColor: uniform(new Color(1, 0.93, 0.78).convertSRGBToLinear()),
  uDiffuseScale: uniform(2.5),
};
