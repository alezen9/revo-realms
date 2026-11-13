import { uniform } from "three/tsl";
import { Color, Vector2, Vector3 } from "three/webgpu";

const FLOWER_HEIGHT = 1;
const TILE_SIZE = 150;
const FLOWERS_PER_SIDE = 128;

export const config = {
  FLOWER_BOUNDING_SPHERE_RADIUS: FLOWER_HEIGHT,
  TILE_SIZE,
  TILE_HALF_SIZE: TILE_SIZE / 2,
  FLOWERS_PER_SIDE,
  COUNT: FLOWERS_PER_SIDE * FLOWERS_PER_SIDE,
  SPACING: TILE_SIZE / FLOWERS_PER_SIDE,
  WORKGROUP_SIZE: 64,
  // each species covers a stretch of meadow this wide, so a drift is mostly one color
  SPECIES_WAVELENGTH: 240,
  SPECIES_COUNT: 4,
  // quartiles of the noise atlas green channel, so each species covers about a
  // quarter of the meadow instead of the two middle ones taking it all
  SPECIES_THRESHOLDS: [0.427, 0.486, 0.553],
};

export const uniforms = {
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uCullPadNDCX: uniform(0.075), // small padding to hide rotation lag
  uCullPadNDCYNear: uniform(0.75), // small padding to avoid near clipping
  uCullPadNDCYFar: uniform(0.2), // small padding to avoid far clipping
  uColor1: uniform(new Color(0.75, 0.75, 0.75).convertSRGBToLinear()),
  uColor2: uniform(new Color(0.7, 0.58, 0.12).convertSRGBToLinear()),
  uColor3: uniform(new Color(0.48, 0.41, 0.6).convertSRGBToLinear()),
  uColor4: uniform(new Color(0.69, 0.25, 0.09).convertSRGBToLinear()),
  uBrightness: uniform(1),
  uWindAmbientStrength: uniform(0.2),
  uWindDirectionalStrength: uniform(0.45),
  uWindSwaySpeed: uniform(0.9),
  uWindVerticalBobStrength: uniform(0.02),
  uMinScale: uniform(0.2),
  uMaxScale: uniform(0.325),
};
