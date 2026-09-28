import { debugPanel } from "../../systems";
import { srgbColorTarget } from "../../systems/debug/tweakpaneColor";
import { uniforms } from "./config";

export const debugFlowers = () => {
  const folder = debugPanel.panel.addFolder({
    title: "🌸 Flowers",
    expanded: false,
  });

  folder.addBinding(srgbColorTarget(uniforms.uColor1.value), "value", {
    label: "Color 1",
    view: "color",
    color: { type: "float" },
  });
  folder.addBinding(srgbColorTarget(uniforms.uColor2.value), "value", {
    label: "Color 2",
    view: "color",
    color: { type: "float" },
  });
  folder.addBinding(uniforms.uBrightness, "value", {
    label: "Brightness",
    min: 0,
    max: 3,
    step: 0.01,
  });
  folder.addBinding(uniforms.uWindAmbientStrength, "value", {
    label: "Wind ambient",
    min: 0,
    max: 0.5,
    step: 0.01,
  });
  folder.addBinding(uniforms.uWindDirectionalStrength, "value", {
    label: "Wind directional",
    min: 0,
    max: 1,
    step: 0.01,
  });
  folder.addBinding(uniforms.uWindSwaySpeed, "value", {
    label: "Wind speed",
    min: 0,
    max: 3,
    step: 0.01,
  });
  folder.addBinding(uniforms.uWindVerticalBobStrength, "value", {
    label: "Wind vertical bob",
    min: 0,
    max: 0.2,
    step: 0.005,
  });
  folder.addBinding(uniforms.uMinScale, "value", {
    label: "Min scale",
    min: 0,
    max: 3,
    step: 0.001,
  });
  folder.addBinding(uniforms.uMaxScale, "value", {
    label: "Max scale",
    min: 0,
    max: 3,
    step: 0.001,
  });
};
