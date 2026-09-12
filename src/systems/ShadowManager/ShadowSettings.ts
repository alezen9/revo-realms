export type ShadowRegistration = {
  cast?: boolean;
  receive?: boolean;
};

export const STATIC_SHADOW_LAYER = 1;
export const GROUND_TEXTURE_SIZE = 2048;
export const SHADOW_PADDING = 12;

export const shadowSettings = {
  resolution: 2048,
  softness: 1,
  blurSamples: 6,
  bias: -0.0001,
  normalBias: 0.04,
  localSize: 64,
  localRecenterDistance: 8,
  localBlendDistance: 4,
  refresh: false,
};
