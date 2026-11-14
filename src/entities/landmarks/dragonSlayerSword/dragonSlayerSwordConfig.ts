import { uniform } from "three/tsl";

export const uniforms = {
  uDiffuseScale: uniform(3.75),
  uNormalScale: uniform(1.5),
  uAoScale: uniform(1),
  uMetalnessScale: uniform(1),
  uRoughnessScale: uniform(1.5),
};
