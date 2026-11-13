import { debugPanel } from "../../systems";
import { uniforms } from "./WindStreaksConfig";

export const debugWindStreaks = () => {
  const folder = debugPanel.panel.addFolder({
    title: "🌬️ Wind streaks",
    expanded: false,
  });

  folder.addBinding(uniforms.uColor, "value", {
    label: "Color",
    view: "color",
    color: { type: "float" },
  });
  const numberBindings = [
    [uniforms.uSpeed, "Speed", 0, 3, 0.01],
    [uniforms.uHeight, "Height", 0.5, 12, 0.1],
    [uniforms.uWidth, "Width", 0.05, 2, 0.01],
    [uniforms.uCurveAmplitude, "Curve amplitude", 0, 10, 0.1],
    [uniforms.uCurveWavelength, "Curve wavelength", 8, 120, 1],
  ] as const;
  for (const [target, label, min, max, stepSize] of numberBindings) {
    folder.addBinding(target, "value", { label, min, max, step: stepSize });
  }
};
