import { Color, Matrix4, Vector2, Vector3 } from "three";
import { uniform } from "three/tsl";

const getConfig = () => {
  const BLADE_WIDTH = 0.15;
  const BLADE_HEIGHT = 1.75;
  const TILE_SIZE = 130;
  const SEGMENTS = 4;
  const BLADES_PER_SIDE = 512 + 512;
  const COUNT = BLADES_PER_SIDE * BLADES_PER_SIDE;
  const MIN_VISIBLE_SCALE = 0.15;
  const DETAILED_WIND_TRANSITION_WIDTH = 5;

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
    DETAILED_WIND_TRANSITION_WIDTH,
  };
};

export const config = getConfig();
export type GrassConfig = typeof config;

export const uniforms = {
  // Culling
  uCameraMatrix: uniform(new Matrix4()),
  uFx: uniform(1.0),
  uFy: uniform(1.0),
  uCullPadNDCX: uniform(0.075),
  uCullPadNDCYNear: uniform(0.75),
  uCullPadNDCYFar: uniform(0.2),

  // Player
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),

  // Scale
  uBladeMinScale: uniform(0.85),
  uBladeMaxScale: uniform(2.35),

  // Trail
  uTrailGrowthRate: uniform(5),
  uTrailMinScale: uniform(0.15),
  uTrailRadius: uniform(0.65),
  uTrailRadiusSquared: uniform(0.65 * 0.65),
  uTrailBendStrength: uniform(0.8),
  uKDown: uniform(50),

  // Wind
  uWindStrength: uniform(0.32),
  uWindSpeed: uniform(0.18),
  uWindUvScale: uniform(1.35),
  uAmbientSwayStrength: uniform(0.055),
  uWindLull: uniform(0.09),
  uWindEddyStrength: uniform(0.9),
  uWindGustCoverage: uniform(0.6),
  uDetailedWindRadius: uniform(30),

  // Color
  uBaseColorDark: uniform(new Color(0.09, 0.15, 0.075).convertSRGBToLinear()),
  uBaseColor: uniform(new Color(0.33, 0.43, 0.3).convertSRGBToLinear()),
  uTipColor: uniform(new Color(0.4, 0.43, 0.32).convertSRGBToLinear()),
  uWarmColor: uniform(new Color(0.66, 0.53, 0.41).convertSRGBToLinear()),
  uRustColor: uniform(new Color(0.38, 0.19, 0.11).convertSRGBToLinear()),
  uColorMixFactor: uniform(0.4),
  uColorVariationStrength: uniform(0.9),
  uWarmVariationStrength: uniform(0.48),
  uRustVariationStrength: uniform(0.08),

  // AO
  uAoScale: uniform(0.5),
  uAoRimSmoothness: uniform(5),
  uAoRadius: uniform(15),
  uAoRadiusSquared: uniform(15 * 15),

  // lighting
  uDiffuseContrast: uniform(0.5),
  uLightExposure: uniform(1.15),
  uHighlightStrength: uniform(0.02),
  uBacklightStrength: uniform(0.13),

  // Stochastic keep
  uFullDensityRadius: uniform(16),
  uDensityFalloffRadius: uniform(75),
  uFarDensity: uniform(0.1),
  uProjectedHeightMin: uniform(0.004),
  uProjectedHeightFull: uniform(0.022),
  uStochasticHysteresis: uniform(0.11),

  // Rotation
  uBaseBending: uniform(2.5),
  uSpriteRotationRandomness: uniform(0.05),
};

export type GrassUniforms = typeof uniforms;
