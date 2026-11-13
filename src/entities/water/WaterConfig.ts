import { Color, Vector2, Vector3 } from "three";
import { uniform } from "three/tsl";
import { lighting } from "../../systems";

export const uniforms = {
  uUvScale: uniform(2.7),
  uNormalScale: uniform(0.05),
  uRefractionStrength: uniform(0.1),
  uFresnelScale: uniform(0.5),
  uSpeed: uniform(0.1),
  uNoiseScrollDir: uniform(new Vector2(0.1, 0)),
  uShininess: uniform(500),
  uMinDist: uniform(0),
  uMaxDist: uniform(0),
  uSunDir: uniform(lighting.sunDirection),
  uSunColor: uniform(lighting.sunColor.clone()),
  uTworld: uniform(new Vector3()),
  uBworld: uniform(new Vector3()),
  uNworld: uniform(new Vector3()),
  uHighlightsGlow: uniform(4),
  uHighlightFresnelInfluence: uniform(0.35),
  uDepthDistance: uniform(20),
  // red absorbs fastest, which pushes the water toward blue and green with depth
  uAbsorptionRGB: uniform(new Vector3(0.35, 0.1, 0.08)),
  uInscatterTint: uniform(new Color(0.0, 0.09, 0.09)),
  uInscatterStrength: uniform(0.85),
  uAbsorptionScale: uniform(15),
  uMinOpacity: uniform(0.5),
  uHighlightsSpread: uniform(0.35),
  uDepthOpacityScale: uniform(0.1),
  uHighlightsDepthOpacityScale: uniform(0.05),
};
