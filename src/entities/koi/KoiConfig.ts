import { uniform } from "three/tsl";

export const config = {
  CRUISE_SPEED: 0.5,
  GIVE_WAY_SPEED: 0.12,
  FLEE_SPEED: 6,
  CRUISE_RESPONSE: 0.8,
  FLEE_RESPONSE: 2.5,
  FLEE_DURATION: 3,
  TURN_RADIUS: 1.2,
  // turning is measured per meter swum, so a fleeing fish draws the same smooth curve as a cruising one
  TURN_CORRECTION_DISTANCE: 0.33,
  TURN_EASE_DISTANCE: 0.125,
  // twice the turn radius, or a fish could circle a goal that sits inside its turn
  MIN_LOOK_AHEAD: 2.5,
  GOAL_PACE: 2,
  DEPTH_RESPONSE: 2,
  FLEE_RADIUS: 6,
  GIVE_WAY_RADIUS: 4,
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
