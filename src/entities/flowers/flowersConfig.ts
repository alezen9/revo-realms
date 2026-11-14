import { uniform } from "three/tsl";
import { Color, Vector2, Vector3 } from "three/webgpu";

const FLOWER_HEIGHT = 1;
const TILE_SIZE = 150;
const FLOWERS_PER_SIDE = 256;

export const config = {
  FLOWER_BOUNDING_SPHERE_RADIUS: FLOWER_HEIGHT,
  TILE_SIZE,
  TILE_HALF_SIZE: TILE_SIZE / 2,
  FLOWERS_PER_SIDE,
  COUNT: FLOWERS_PER_SIDE * FLOWERS_PER_SIDE,
  SPACING: TILE_SIZE / FLOWERS_PER_SIDE,
  WORKGROUP_SIZE: 64,
  SPECIES_COUNT: 4,
};

export const uniforms = {
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uCullPadNDCX: uniform(0.075), // small padding to hide rotation lag
  uCullPadNDCYNear: uniform(0.75), // small padding to avoid near clipping
  uCullPadNDCYFar: uniform(0.2), // small padding to avoid far clipping
  uColor1: uniform(new Color(0.92, 0.9, 0.84).convertSRGBToLinear()),
  uColor2: uniform(new Color(0.96, 0.7, 0.06).convertSRGBToLinear()),
  uColor3: uniform(new Color(0.58, 0.36, 0.86).convertSRGBToLinear()),
  uColor4: uniform(new Color(0.86, 0.1, 0.07).convertSRGBToLinear()),
  uBrightness: uniform(1),
  uWindAmbientStrength: uniform(0.2),
  uWindDirectionalStrength: uniform(0.45),
  uWindSwaySpeed: uniform(0.9),
  uWindVerticalBobStrength: uniform(0.02),
  uMinScale: uniform(0.2),
  uMaxScale: uniform(0.325),
};
