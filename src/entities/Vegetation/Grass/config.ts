import { Color, Matrix4, Vector2, Vector3 } from "three";
import { uniform, uniformArray } from "three/tsl";

const getBladeIndexCount = (segments: number) =>
  Math.max(0, segments - 1) * 6 + 3;

const getDrawProfile = (segments: number) => ({
  segments,
  indexCount: getBladeIndexCount(segments),
});

const getConfig = () => {
  const BLADE_WIDTH = 0.175;
  const BLADE_HEIGHT = 1.75;
  const TILE_SIZE = 130;
  // near to far, one indirect draw per entry
  const LOD_DRAW_PROFILES = [8, 4, 2].map(getDrawProfile);
  const FALLBACK_DRAW_PROFILE = getDrawProfile(4);
  const BLADES_PER_SIDE = 512 + 256 + 128;
  const COUNT = BLADES_PER_SIDE * BLADES_PER_SIDE;
  const MIN_VISIBLE_SCALE = 0.15;
  const DETAILED_WIND_TRANSITION_WIDTH = 5;

  return {
    LOD_DRAW_PROFILES,
    LOD_COUNT: LOD_DRAW_PROFILES.length,
    FALLBACK_DRAW_PROFILE,
    // indexCount, instanceCount, firstIndex, baseVertex, firstInstance
    INDIRECT_ARGS_STRIDE: 5,
    INDEX_COUNT_INDEX: 0,
    INSTANCE_COUNT_INDEX: 1,
    FIRST_INSTANCE_INDEX: 4,
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
  uCullPadNDCX: uniform(0.075),
  uCullPadNDCYNear: uniform(0.75),
  uCullPadNDCYFar: uniform(0.2),

  // LOD
  uLod0Radius: uniform(15),
  uLod0RadiusSquared: uniform(15 * 15),
  uLod1Radius: uniform(35),
  uLod1RadiusSquared: uniform(35 * 35),
  uLodEnabled: uniform(1),
  uLodDebugEnabled: uniform(0),
  uLodDebugColors: uniformArray(
    [new Color("green"), new Color("blue"), new Color("red")],
    "color" as const,
  ),

  // Player
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),

  // Width
  uBladeWidth: uniform(config.BLADE_WIDTH),
  uWidthFarGain: uniform(1),
  uWidthNearRadius: uniform(20),
  uWidthNearRadiusSquared: uniform(20 * 20),
  uWidthFarRadius: uniform(60),
  uWidthFarRadiusSquared: uniform(60 * 60),

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
  uWindCurveP1: uniform(0.003),
  uWindCurveP2: uniform(0.85),
  uBendDropStrength: uniform(1.3),
  uBendControlPoint: uniform(0.4),

  // Color
  uBaseColorDark: uniform(new Color(0.09, 0.15, 0.075).convertSRGBToLinear()),
  uBaseColor: uniform(new Color(0.23, 0.38, 0.19).convertSRGBToLinear()),
  uTipColor: uniform(new Color(0.35, 0.43, 0.32).convertSRGBToLinear()),
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
  uRootSkyVisibility: uniform(0.6),

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
