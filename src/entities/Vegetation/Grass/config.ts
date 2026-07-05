import {
  Color,
  Matrix4,
  Vector2,
  Vector3,
} from "three";
import { uniform } from "three/tsl";

const getConfig = () => {
  const BLADE_WIDTH = 0.065;
  const BLADE_HEIGHT = 1.75;
  const TILE_SIZE = 130;
  const BLADES_PER_SIDE = 512 + 512; // power of 2 is optimal, divisible by wg also good
  return {
    SEGMENTS: 3,
    BLADE_WIDTH,
    BLADE_HEIGHT,
    BLADE_BOUNDING_SPHERE_RADIUS: BLADE_HEIGHT,
    TILE_SIZE,
    TILE_HALF_SIZE: TILE_SIZE / 2,
    BLADES_PER_SIDE,
    COUNT: BLADES_PER_SIDE * BLADES_PER_SIDE,
    SPACING: TILE_SIZE / BLADES_PER_SIDE,
    WORKGROUP_SIZE: 64,
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
  uBaseColor: uniform(new Color().setRGB(0.06, 0.2, 0.07)),
  uTipColor: uniform(new Color().setRGB(0.5, 0.27, 0.13)),
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
};
export type GrassUniforms = typeof uniforms;
