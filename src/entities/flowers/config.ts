import { uniform } from "three/tsl";
import { Color, Vector2, Vector3 } from "three/webgpu";

const FLOWER_HEIGHT = 1;
const TILE_SIZE = 150;
const FLOWERS_PER_SIDE = 64;
const MIN_SCALE = 0.2;
const MAX_SCALE = 0.325;

export const config = {
  FLOWER_BOUNDING_SPHERE_RADIUS: FLOWER_HEIGHT,
  TILE_SIZE,
  TILE_HALF_SIZE: TILE_SIZE / 2,
  FLOWERS_PER_SIDE,
  COUNT: FLOWERS_PER_SIDE * FLOWERS_PER_SIDE,
  SPACING: TILE_SIZE / FLOWERS_PER_SIDE,
  WORKGROUP_SIZE: 64,
};

export const uniforms = {
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uCullPadNDCX: uniform(0.075), // small padding to hide rotation lag
  uCullPadNDCYNear: uniform(0.75), // small padding to avoid near clipping
  uCullPadNDCYFar: uniform(0.2), // small padding to avoid far clipping
  uColor1: uniform(new Color(0.54, 0.54, 0.54).convertSRGBToLinear()),
  uColor2: uniform(new Color(0.99, 0.48, 0.0).convertSRGBToLinear()),
  uBrightness: uniform(1),
  uWindAmbientStrength: uniform(0.2),
  uWindDirectionalStrength: uniform(0.45),
  uWindSwaySpeed: uniform(0.9),
  uWindVerticalBobStrength: uniform(0.02),
  uMinScale: uniform(MIN_SCALE),
  uMaxScale: uniform(MAX_SCALE),
};
