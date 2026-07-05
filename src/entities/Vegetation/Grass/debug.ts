import { debugManager } from "../../../systems";
import type { GrassConfig, GrassUniforms } from "./config";

export const debugGrass = (uniforms: GrassUniforms, config: GrassConfig) => {
  const folder = debugManager.panel.addFolder({
    title: "🌱 Grass",
    expanded: false,
  });

  const color = folder.addFolder({ title: "Color" });
  color.addBinding(uniforms.uTipColor, "value", {
    label: "Tip",
    view: "color",
    color: { type: "float" },
  });
  color.addBinding(uniforms.uBaseColor, "value", {
    label: "Base",
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
    label: "Variation strength",
    min: 0,
    max: 3,
    step: 0.01,
  });
  color.addBinding(uniforms.uBaseWindShade, "value", {
    label: "Wind shade strength",
    min: 0,
    max: 2,
    step: 0.01,
  });
  color.addBinding(uniforms.uBaseShadeHeight, "value", {
    label: "Wind shade height",
    min: 0,
    max: 1,
    step: 0.01,
  });
  color.addBinding(uniforms.uAoScale, "value", {
    label: "AO scale",
    min: 0,
    max: 5,
    step: 0.01,
  });
  color.addBinding(uniforms.uAoRimSmoothness, "value", {
    label: "AO rim smoothness",
    min: 0,
    max: 5,
    step: 0.01,
  });
  color
    .addBinding(uniforms.uAoRadius, "value", {
      label: "AO radius",
      min: 0,
      max: 100,
      step: 0.01,
    })
    .on("change", ({ value }) => {
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
  wind.addBinding(uniforms.uvWindScale, "value", {
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

  const stochastic = folder.addFolder({ title: "Stochastic keep" });
  stochastic.addBinding(uniforms.uR0, "value", {
    label: "Inner ring",
    min: 0,
    max: config.TILE_SIZE,
    step: 0.1,
  });
  stochastic.addBinding(uniforms.uR1, "value", {
    label: "Outer ring",
    min: 0,
    max: config.TILE_SIZE,
    step: 0.1,
  });
  stochastic.addBinding(uniforms.uPMin, "value", {
    label: "P Min",
    min: 0,
    max: 1,
    step: 0.01,
  });
  stochastic.addBinding(uniforms.uProjectedMin, "value", {
    label: "Projected min",
    min: 0,
    max: 0.2,
    step: 0.001,
  });
  stochastic.addBinding(uniforms.uProjectedFull, "value", {
    label: "Projected full",
    min: 0,
    max: 0.2,
    step: 0.001,
  });
  stochastic.addBinding(uniforms.uStochasticHysteresis, "value", {
    label: "Hysteresis",
    min: 0,
    max: 0.25,
    step: 0.001,
  });

  const trail = folder.addFolder({ title: "Trail" });
  trail.addBinding(uniforms.uTrailGrowthRate, "value", {
    label: "Growth rate",
    min: 0,
    max: 0.1,
    step: 0.001,
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
    max: 5,
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
  general.addBinding(uniforms.uCullPadNDCX, "value", {
    label: "Cull pad X",
    min: 0,
    max: 0.5,
    step: 0.001,
  });
  general.addBinding(uniforms.uCullPadNDCYNear, "value", {
    label: "Cull pad Y (near)",
    min: 0,
    max: 1,
    step: 0.001,
  });
  general.addBinding(uniforms.uCullPadNDCYFar, "value", {
    label: "Cull pad Y (far)",
    min: 0,
    max: 1,
    step: 0.001,
  });
};
