import { debugPanel } from "../../systems";
import { uniforms } from "./WindParticlesConfig";

export const debugWindParticles = () => {
  const folder = debugPanel.panel.addFolder({
    title: "🌬️ Wind particles",
    expanded: false,
  });

  folder.addBinding(uniforms.uColor, "value", {
    label: "Color",
    view: "color",
    color: { type: "float" },
  });
  folder.addBinding(uniforms.uSpeed, "value", {
    label: "Speed",
    min: 0,
    max: 3,
    step: 0.01,
  });
  folder.addBinding(uniforms.uTurbulence, "value", {
    label: "Turbulence",
    min: 0,
    max: 3,
    step: 0.01,
  });
  folder.addBinding(uniforms.uHeight, "value", {
    label: "Height",
    min: 0.5,
    max: 12,
    step: 0.1,
  });
  folder.addBinding(uniforms.uSize, "value", {
    label: "Size",
    min: 0.25,
    max: 4,
    step: 0.01,
  });
};
