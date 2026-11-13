import { Color } from "three";
import { uniform } from "three/tsl";

export const uniforms = {
  uTint: uniform(new Color(0.33, 0.55, 0.3)),
  uVariantTint: uniform(new Color(0.5, 0.5, 0.22)),
  uBrightnessSpread: uniform(0.25),
  uDiffuseScale: uniform(3.5),
};
