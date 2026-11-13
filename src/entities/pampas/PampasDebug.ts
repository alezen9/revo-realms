import { debugPanel } from "../../systems";
import { srgbColorTarget } from "../../systems/debug/tweakpaneColor";
import { uniforms } from "./PampasConfig";

export const debugPampas = () => {
  const folder = debugPanel.panel.addFolder({
    title: "🌾 Pampas",
    expanded: false,
  });
  folder.addBinding(uniforms.uDensity, "value", {
    label: "Density",
    min: 0,
    max: 1,
    step: 0.01,
  });
  folder.addBinding(srgbColorTarget(uniforms.uTint.value), "value", {
    label: "Tint",
    view: "color",
    color: { type: "float" },
  });
  folder.addBinding(uniforms.uBrightness, "value", {
    label: "Brightness",
    min: 0,
    max: 3,
    step: 0.01,
  });
  folder.addBinding(uniforms.uAmbientSway, "value", {
    label: "Ambient sway",
    min: 0,
    max: 0.5,
    step: 0.01,
  });
  folder.addBinding(uniforms.uGustLean, "value", {
    label: "Gust lean",
    min: 0,
    max: 1.5,
    step: 0.01,
  });
  folder.addBinding(uniforms.uPlayerPush, "value", {
    label: "Player push",
    min: 0,
    max: 2,
    step: 0.01,
  });
  folder.addBinding(uniforms.uFlutter, "value", {
    label: "Flutter",
    min: 0,
    max: 0.3,
    step: 0.005,
  });
};
