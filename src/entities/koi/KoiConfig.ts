import { uniform } from "three/tsl";

export const config = {
  FISH_COUNT: 5,
  CRUISE_SPEED: 0.5,
  FLEE_SPEED: 6,
  CRUISE_RESPONSE: 0.8,
  FLEE_RESPONSE: 2.5,
  FLEE_RADIUS: 6,
  FLEE_DURATION: 3,
  TURN_RADIUS: 1.2,
  // turning is measured per meter swum, so a fleeing fish draws the same smooth curve as a cruising one
  TURN_CORRECTION_DISTANCE: 0.33,
  TURN_EASE_DISTANCE: 0.125,
  WANDER_TURN: 0.06,
  WANDER_RATE: 0.35,
  FLEE_WANDER_WEIGHT: 0.3,
  FLEE_FADE_RADII: 2,
  SEPARATION_RADIUS: 3.5,
  SEPARATION_STRENGTH: 2,
  SEPARATION_DEPTH_PUSH: 2,
  AVOID_DISTANCE: 3,
  AVOID_DISTANCE_PER_SPEED: 0.5,
  AVOID_STRENGTH: 3,
  DEPTH_RESPONSE: 2,
  DEPTH_LOOK_AHEAD: 0.6,
  MIN_CALM_HEIGHT_RATIO: 0.3,
  MAX_CALM_HEIGHT_RATIO: 0.8,
  SPAWN_CLEARANCE: 3,
  SPAWN_SPACING: 8,
  SPAWN_SEED: 7,
  CRUISE_BEAT_RATE: 2.5,
  BEAT_RATE_PER_SPEED: 2,
  BODY_WAVE: 3.5,
  CRUISE_SWING: 0.07,
  FLEE_SWING: 0.12,
  SIZES: [2.3, 2.65, 3, 1.6, 1.95],
  COLORINGS: [
    "koiRedWhiteDiffuse",
    "koiRedBlackDiffuse",
    "koiGoldDiffuse",
  ] as const,
};

export const uniforms = {
  uDiffuseScale: uniform(2.5),
};
