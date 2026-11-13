import { debugPanel } from "../../systems";
import { uniforms } from "./LakePlantsConfig";

export const debugLakePlants = () => {
  const folder = debugPanel.panel.addFolder({
    title: "🌿 Lake plants",
    expanded: false,
  });
  folder.addBinding(uniforms.uTint, "value", {
    label: "Tint",
    view: "color",
    color: { type: "float" },
  });
  folder.addBinding(uniforms.uVariantTint, "value", {
    label: "Seaweed variant tint",
    view: "color",
    color: { type: "float" },
  });
  folder.addBinding(uniforms.uBrightnessSpread, "value", {
    label: "Seaweed brightness spread",
    min: 0,
    max: 0.6,
    step: 0.01,
  });
  folder.addBinding(uniforms.uDiffuseScale, "value", {
    label: "Diffuse scale",
    min: 0,
    max: 6,
  });
};
