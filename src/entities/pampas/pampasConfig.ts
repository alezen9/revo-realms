import { uniform } from "three/tsl";
import { Color, Vector2, Vector3 } from "three/webgpu";

const PLANT_HEIGHT = 2.2;
const TILE_SIZE = 150;
const CLUMPS_PER_SIDE = 50;
const PLANTS_PER_CLUMP = 12;

export const config = {
  PLANT_HEIGHT,
  PLANT_WIDTH: PLANT_HEIGHT / 2,
  TILE_SIZE,
  TILE_HALF_SIZE: TILE_SIZE / 2,
  CLUMPS_PER_SIDE,
  PLANTS_PER_CLUMP,
  COUNT: CLUMPS_PER_SIDE * CLUMPS_PER_SIDE * PLANTS_PER_CLUMP,
  CLUMP_SPACING: TILE_SIZE / CLUMPS_PER_SIDE,
  CLUMP_RADIUS: 1.5,
  MIN_CLUMP_FULLNESS: 0.35,
  WORKGROUP_SIZE: 64,
  MIN_HEIGHT: 0.85,
  MAX_HEIGHT: 1.55,
  MIN_THICKNESS: 0.7,
  MAX_THICKNESS: 1.4,
  PLAYER_PUSH_RADIUS: 2.5,
  PRESS_RATE: 4,
  RECOVERY_RATE: 1.5,
};

export const uniforms = {
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uCullPadNDCX: uniform(0.075),
  uCullPadNDCYNear: uniform(0.75),
  uCullPadNDCYFar: uniform(0.2),
  uDensity: uniform(0.2),
  uTint: uniform(new Color(1, 0.9, 0.72).convertSRGBToLinear()),
  uBrightness: uniform(0.7),
  uAmbientSway: uniform(0.12),
  uGustLean: uniform(0.45),
  uFlutter: uniform(0.06),
  uPlayerPush: uniform(0.6),
};
