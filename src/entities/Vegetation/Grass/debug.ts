import { debugManager } from "../../../systems";
import { srgbColorTarget } from "../../../utils/TweakpaneColor";
import type { GrassConfig, GrassUniforms } from "./config";

export const debugGrass = (uniforms: GrassUniforms, config: GrassConfig) => {
  const folder = debugManager.panel.addFolder({
    title: "🌱 Grass",
    expanded: false,
  });

  const color = folder.addFolder({ title: "Color" });
  color.addBinding(srgbColorTarget(uniforms.uTipColor.value), "value", {
    label: "Tip",
    view: "color",
    color: { type: "float" },
  });
  color.addBinding(srgbColorTarget(uniforms.uBaseColor.value), "value", {
    label: "Base",
    view: "color",
    color: { type: "float" },
  });
  color.addBinding(srgbColorTarget(uniforms.uBaseColorDark.value), "value", {
    label: "Base dark",
    view: "color",
    color: { type: "float" },
  });
  color.addBinding(srgbColorTarget(uniforms.uWarmColor.value), "value", {
    label: "Warm",
    view: "color",
    color: { type: "float" },
  });
  color.addBinding(srgbColorTarget(uniforms.uRustColor.value), "value", {
    label: "Rust",
    view: "color",
    color: { type: "float" },
  });
  color.addBinding(uniforms.uColorMixFactor, "value", {
    label: "Mix factor",
    min: 0,
    max: 1,
    step: 0.01,
  });
  color.addBinding(uniforms.uColorVariationStrength, "value", {
    label: "Olive variation",
    min: 0,
    max: 1,
    step: 0.01,
  });
  color.addBinding(uniforms.uWarmVariationStrength, "value", {
    label: "Warm variation",
    min: 0,
    max: 1,
    step: 0.01,
  });
  color.addBinding(uniforms.uRustVariationStrength, "value", {
    label: "Rust variation",
    min: 0,
    max: 1,
    step: 0.01,
  });

  const lighting = folder.addFolder({ title: "Lighting" });
  lighting.addBinding(uniforms.uDiffuseContrast, "value", {
    label: "Diffuse contrast",
    min: 0,
    max: 1,
    step: 0.01,
  });
  lighting.addBinding(uniforms.uLightExposure, "value", {
    label: "Exposure",
    min: 0,
    max: 3,
    step: 0.01,
  });
  lighting.addBinding(uniforms.uHighlightStrength, "value", {
    label: "Highlight strength",
    min: 0,
    max: 0.5,
    step: 0.005,
  });
  lighting.addBinding(uniforms.uBacklightStrength, "value", {
    label: "Backlight strength",
    min: 0,
    max: 1,
    step: 0.01,
  });
  lighting.addBinding(uniforms.uRootSkyVisibility, "value", {
    label: "Root sky visibility",
    min: 0,
    max: 1,
    step: 0.01,
  });

  const ao = folder.addFolder({ title: "AO" });
  ao.addBinding(uniforms.uAoScale, "value", {
    label: "Scale",
    min: 0,
    max: 5,
    step: 0.01,
  });
  ao.addBinding(uniforms.uAoRimSmoothness, "value", {
    label: "Rim smoothness",
    min: 0,
    max: 5,
    step: 0.01,
  });
  ao.addBinding(uniforms.uAoRadius, "value", {
    label: "Radius",
    min: 0,
    max: config.TILE_HALF_SIZE,
    step: 0.1,
  }).on("change", ({ value }) => {
    uniforms.uAoRadiusSquared.value = value * value;
  });

  const wind = folder.addFolder({ title: "Wind" });
  wind.addBinding(uniforms.uWindStrength, "value", {
    label: "Strength",
    min: 0,
    max: Math.PI,
    step: 0.01,
  });
  wind.addBinding(uniforms.uWindSpeed, "value", {
    label: "Speed",
    min: 0,
    max: 1,
    step: 0.01,
  });
  wind.addBinding(uniforms.uWindUvScale, "value", {
    label: "UV scale",
    step: 0.01,
    min: 0,
    max: 10,
  });
  wind.addBinding(uniforms.uAmbientSwayStrength, "value", {
    label: "Ambient sway",
    min: 0,
    max: 0.15,
    step: 0.001,
  });
  wind.addBinding(uniforms.uWindLull, "value", {
    label: "Calm floor",
    min: 0,
    max: 1,
    step: 0.01,
  });
  wind.addBinding(uniforms.uWindEddyStrength, "value", {
    label: "Eddy strength",
    min: 0,
    max: 1.5,
    step: 0.01,
  });
  wind.addBinding(uniforms.uWindGustCoverage, "value", {
    label: "Gust coverage",
    min: 0,
    max: 1,
    step: 0.01,
  });
  wind.addBinding(uniforms.uDetailedWindRadius, "value", {
    label: "Detailed radius",
    min: 0,
    max: config.TILE_HALF_SIZE * Math.SQRT2,
    step: 1,
  });
  wind.addBinding(uniforms.uWindCurveP1, "value", {
    label: "Wind curve short",
    min: 0,
    max: 1,
    step: 0.01,
  });
  wind.addBinding(uniforms.uWindCurveP2, "value", {
    label: "Wind curve tall",
    min: 0,
    max: 1,
    step: 0.01,
  });
  wind.addBinding(uniforms.uBendDropStrength, "value", {
    label: "Bend drop",
    min: 0,
    max: 4,
    step: 0.05,
  });

  const density = folder.addFolder({ title: "Density" });
  density.addBinding(uniforms.uDensityFalloffRadius, "value", {
    label: "Density falloff radius",
    min: 0,
    max: config.TILE_SIZE,
    step: 0.1,
  });
  density.addBinding(uniforms.uFarDensity, "value", {
    label: "Far density",
    min: 0,
    max: 1,
    step: 0.01,
  });
  density.addBinding(uniforms.uStochasticHysteresis, "value", {
    label: "Stochastic hysteresis",
    min: 0,
    max: 0.5,
    step: 0.01,
  });

  const trail = folder.addFolder({ title: "Trail" });
  trail.addBinding(uniforms.uTrailGrowthRate, "value", {
    label: "Growth rate",
    min: 0,
    max: 10,
    step: 0.1,
  });
  trail.addBinding(uniforms.uTrailMinScale, "value", {
    label: "Min scale",
    min: 0,
    max: 1,
    step: 0.01,
  });
  trail.addBinding(uniforms.uKDown, "value", {
    label: "Crushing speed",
    min: 0,
    max: 100,
    step: 1,
  });
  trail.addBinding(uniforms.uTrailBendStrength, "value", {
    label: "Bend strength",
    min: 0,
    max: 2,
    step: 0.01,
  });
  trail
    .addBinding(uniforms.uTrailRadius, "value", {
      label: "Trail radius",
      min: 0,
      max: 2,
      step: 0.01,
    })
    .on("change", ({ value }) => {
      uniforms.uTrailRadiusSquared.value = value * value;
    });

  const general = folder.addFolder({ title: "General" });
  general.addBinding(uniforms.uBaseBending, "value", {
    label: "Base bend",
    min: -Math.PI * 2,
    max: Math.PI * 2,
    step: 0.01,
  });
  general.addBinding(uniforms.uSpriteRotationRandomness, "value", {
    label: "Sprite rotation",
    min: 0,
    max: Math.PI * 0.5,
    step: 0.01,
  });
  general.addBinding(uniforms.uBladeMinScale, "value", {
    label: "Min scale",
    min: 0,
    max: 5,
    step: 0.01,
  });
  general.addBinding(uniforms.uBladeMaxScale, "value", {
    label: "Max scale",
    min: 0,
    max: 5,
    step: 0.01,
  });
};
