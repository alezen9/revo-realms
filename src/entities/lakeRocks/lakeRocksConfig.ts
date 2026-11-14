import { uniform } from "three/tsl";

export const config = {
  ROCKS: [
    "lake-rock-4",
    "lake-rock-1",
    "lake-rock-2",
    "lake-rock-3",
    "lake-rock-5",
  ],
};

export const uniforms = {
  uDiffuseScale: uniform(1),
  uShadeDepth: uniform(0.8),
  uUvScale: uniform(1.25),
};
