import { debugPanel } from "../../systems";
import { uniforms } from "./waterLiliesConfig";

export const debugWaterLilies = () => {
  const folder = debugPanel.panel.addFolder({
    title: "🪷 Water lilies",
    expanded: false,
  });
  folder.addBinding(uniforms.uTint, "value", {
    label: "Tint",
    view: "color",
    color: { type: "float" },
  });
  folder.addBinding(uniforms.uRoughness, "value", {
    label: "Roughness",
    min: 0,
    max: 1,
    step: 0.01,
  });
  folder.addBinding(uniforms.uNormalScale, "value", {
    label: "Normal scale",
    min: 0,
    max: 4,
    step: 0.01,
  });
  folder.addBinding(uniforms.uDiffuseScale, "value", {
    label: "Diffuse scale",
    min: 0,
    max: 5,
  });
  folder.addBinding(uniforms.uBob, "value", {
    label: "Bob",
    min: 0,
    max: 0.1,
    step: 0.001,
  });
  folder.addBinding(uniforms.uDipDepth, "value", {
    label: "Dip depth",
    min: 0,
    max: 1,
    step: 0.01,
  });
};
