import { Color, Matrix4, Vector2, Vector3 } from "three";
import { uniform } from "three/tsl";

const getConfig = () => {
  const BLADE_WIDTH = 0.15;
  const BLADE_HEIGHT = 1.75;
  const TILE_SIZE = 130;
  const SEGMENTS = 4;
  const BLADES_PER_SIDE = 512 + 512; // power of 2 is optimal, divisible by wg also good
  const COUNT = BLADES_PER_SIDE * BLADES_PER_SIDE;
  const MIN_VISIBLE_SCALE = 0.05; // skip almost-flat blades produced near grass-map edges

  return {
    SEGMENTS,
    BLADE_INDEX_COUNT: Math.max(0, SEGMENTS - 1) * 6 + 3,
    BLADE_WIDTH,
    BLADE_HEIGHT,
    BLADE_BOUNDING_SPHERE_RADIUS: BLADE_HEIGHT,
    TILE_SIZE,
    TILE_HALF_SIZE: TILE_SIZE / 2,
    BLADES_PER_SIDE,
    COUNT,
    SPACING: TILE_SIZE / BLADES_PER_SIDE,
    WORKGROUP_SIZE: 64,
    MIN_VISIBLE_SCALE,
  };
};

export const config = getConfig();
export type GrassConfig = typeof config;

export const uniforms = {
  // culling
  uCameraMatrix: uniform(new Matrix4()), // MVP = Projection * View
  uFx: uniform(1.0),
  uFy: uniform(1.0),
  uCullPadNDCX: uniform(0.075), // small padding to hide rotation lag
  uCullPadNDCYNear: uniform(0.75), // small padding to avoid near clipping
  uCullPadNDCYFar: uniform(0.2), // small padding to avoid far clipping
  // other
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),
  uPlayerRadius: uniform(0.5),
  uCameraForward: uniform(new Vector3(0, 0, 0)),
  uSunDir: uniform(new Vector3(0)),
  // Scale
  uBladeMinScale: uniform(0.65),
  uBladeMaxScale: uniform(2.25),
  // Trail
  uTrailGrowthRate: uniform(0.04),
  uTrailMinScale: uniform(0.25),
  uTrailRadius: uniform(1),
  uTrailRadiusSquared: uniform(1),
  uKDown: uniform(0.4),
  // Wind
  uWindStrength: uniform(0.28),
  uWindSpeed: uniform(0.18),
  uvWindScale: uniform(1.35),
  uAmbientSwayStrength: uniform(0.055),
  // Color
  uBaseColor: uniform(new Color(0.27, 0.49, 0.29).convertSRGBToLinear()),
  uTipColor: uniform(new Color(0.74, 0.56, 0.4).convertSRGBToLinear()),
  uColorMixFactor: uniform(0.15),
  uColorVariationStrength: uniform(2),
  uAoScale: uniform(0.5),
  uAoRimSmoothness: uniform(5),
  uAoRadius: uniform(15),
  uAoRadiusSquared: uniform(15 * 15),
  uBaseWindShade: uniform(0.75),
  uBaseShadeHeight: uniform(1),
  // Stochastic keep
  uR0: uniform(16),
  uR1: uniform(50),
  uPMin: uniform(0.14),
  uProjectedMin: uniform(0.004),
  uProjectedFull: uniform(0.022),
  uStochasticHysteresis: uniform(0.11),
  // Rotation
  uBaseBending: uniform(2.5),
  uSpriteRotationRandomness: uniform(0.05),
};

export type GrassUniforms = typeof uniforms;
