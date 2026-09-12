export type ShadowRegistration = {
  cast?: boolean;
  mobility?: "static" | "dynamic";
  receive?: boolean;
};

export type GroundShadowLevelSettings = {
  blendDistance: number;
  name: string;
  recenterDistance: number;
  size: number;
  textureSize: number;
  transitionDuration: number;
};

export const STATIC_SHADOW_LAYER = 1;
export const DYNAMIC_SHADOW_LAYER = 2;
export const GLOBAL_GROUND_TEXTURE_SIZE = 4096;
export const SHADOW_PADDING = 12;

export const dynamicShadowSettings = {
  bias: -0.0003,
  isEnabled: true,
  normalBias: 0.035,
  radius: 32,
  resolution: 1024,
};

export const groundShadowLevelSettings: GroundShadowLevelSettings[] = [
  {
    name: "near",
    size: 64,
    recenterDistance: 16,
    blendDistance: 12,
    textureSize: 2048,
    transitionDuration: 0.5,
  },
  {
    name: "middle",
    size: 128,
    recenterDistance: 32,
    blendDistance: 20,
    textureSize: 2048,
    transitionDuration: 0.5,
  },
  {
    name: "far",
    size: 256,
    recenterDistance: 64,
    blendDistance: 32,
    textureSize: 2048,
    transitionDuration: 0.5,
  },
];

export const shadowSettings = {
  resolution: 2048,
  softness: 1,
  blurSamples: 6,
  bias: -0.0001,
  normalBias: 0.04,
  refresh: false,
};
