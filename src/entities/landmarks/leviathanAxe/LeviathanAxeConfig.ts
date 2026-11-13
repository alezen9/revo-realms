import { uniform } from "three/tsl";

export const uniforms = {
  uDiffuseScale: uniform(4),
  uNormalScale: uniform(1.25),
  uAoScale: uniform(0.75),
  uMetalnessScale: uniform(1),
  uRoughnessScale: uniform(1.5),
  uEmissionScale: uniform(20),
};
