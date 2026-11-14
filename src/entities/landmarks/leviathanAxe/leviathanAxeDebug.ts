import { debugPanel } from "../../../systems";
import { uniforms } from "./leviathanAxeConfig";

export const debugLeviathanAxe = () => {
  const folder = debugPanel.panel.addFolder({
    title: "🪓 God of War",
    expanded: false,
  });
  folder.addBinding(uniforms.uDiffuseScale, "value", {
    label: "Diffuse scale",
    min: 0,
  });
  folder.addBinding(uniforms.uNormalScale, "value", {
    label: "Normal scale",
    min: 0,
  });
  folder.addBinding(uniforms.uEmissionScale, "value", {
    label: "Emission scale",
    min: 0,
  });
  folder.addBinding(uniforms.uAoScale, "value", {
    label: "AO scale",
    min: 0,
  });
  folder.addBinding(uniforms.uMetalnessScale, "value", {
    label: "Metalness scale",
    min: 0,
  });
  folder.addBinding(uniforms.uRoughnessScale, "value", {
    label: "Roughness scale",
    min: 0,
  });
};
