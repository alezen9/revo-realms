import { debugPanel } from "../../systems";
import { uniforms } from "./waterConfig";

export const debugWater = () => {
  const folder = debugPanel.panel.addFolder({
    title: "🌊 Water",
    expanded: false,
  });

  const waves = folder.addFolder({
    title: "Waves",
    expanded: true,
  });

  waves.addBinding(uniforms.uSpeed, "value", {
    label: "Speed",
  });
  waves.addBinding(uniforms.uNormalScale, "value", {
    label: "Normal scale",
  });
  waves.addBinding(uniforms.uUvScale, "value", {
    label: "UV scale",
  });

  const highlights = folder.addFolder({
    title: "Highlights",
    expanded: true,
  });

  highlights.addBinding(uniforms.uShininess, "value", {
    label: "Shininess",
  });
  highlights.addBinding(uniforms.uHighlightsGlow, "value", {
    label: "Glow",
  });
  highlights.addBinding(uniforms.uHighlightFresnelInfluence, "value", {
    label: "Fresnel influence",
  });
  highlights.addBinding(uniforms.uSunColor, "value", {
    label: "Sun color",
    view: "color",
    color: { type: "float" },
  });
  highlights.addBinding(uniforms.uHighlightsSpread, "value", {
    label: "Highlights spread",
  });
  highlights.addBinding(uniforms.uHighlightsDepthOpacityScale, "value", {
    label: "Shoreline opacity",
    step: 0.001,
  });

  const reflectionsAndRefraction = folder.addFolder({
    title: "Reflections / Refraction",
    expanded: true,
  });
  reflectionsAndRefraction.addBinding(uniforms.uRefractionStrength, "value", {
    label: "Refraction strength",
  });
  reflectionsAndRefraction.addBinding(uniforms.uFresnelScale, "value", {
    label: "Fresnel scale",
  });

  const beerLambert = folder.addFolder({
    title: "Beer-Lambert",
    expanded: true,
  });
  beerLambert.addBinding(uniforms.uInscatterStrength, "value", {
    label: "Inscatter strength",
  });
  beerLambert.addBinding(uniforms.uInscatterTint, "value", {
    label: "Inscatter tint",
    view: "color",
    color: { type: "float" },
  });
  beerLambert.addBinding(uniforms.uAbsorptionRGB, "value", {
    label: "Absorption coeff",
  });
  beerLambert.addBinding(uniforms.uAbsorptionScale, "value", {
    label: "Absorption scale",
  });

  const general = folder.addFolder({
    title: "General",
    expanded: true,
  });
  general.addBinding(uniforms.uMinOpacity, "value", {
    label: "Min opacity",
  });
  general.addBinding(uniforms.uMinDist, "value", {
    label: "Min opacity distance",
  });
  general.addBinding(uniforms.uMaxDist, "value", {
    label: "Max opacity distance",
  });
  general.addBinding(uniforms.uDepthDistance, "value", {
    label: "Depth distance",
  });
  general.addBinding(uniforms.uDepthOpacityScale, "value", {
    label: "Depth opacity scale",
  });
};
