import { debugPanel } from "../../../systems";
import { petalUniforms } from "./expedition33PetalsConfig";

export const debugExpedition33Petals = () => {
  const petals = debugPanel.panel.addFolder({
    title: "🌹 Expedition 33 petals",
    expanded: false,
  });
  petals.addBinding(petalUniforms.uFallSpeed, "value", {
    label: "Fall speed",
    min: 0,
    max: 3,
  });
  petals.addBinding(petalUniforms.uWindSpeed, "value", {
    label: "Wind speed",
    min: 0,
    max: 10,
  });
  petals.addBinding(petalUniforms.uSway, "value", {
    label: "Sway",
    min: 0,
    max: 3,
  });
  petals.addBinding(petalUniforms.uSpin, "value", {
    label: "Spin",
    min: 0,
    max: 6,
  });
  petals.addBinding(petalUniforms.uAirDrag, "value", {
    label: "Air drag",
    min: 0.1,
    max: 6,
  });
  petals.addBinding(petalUniforms.uInheritedSpeed, "value", {
    label: "Inherited speed",
    min: 0,
    max: 1,
  });
  petals.addBinding(petalUniforms.uSize, "value", {
    label: "Size",
    min: 0.05,
    max: 1.5,
    step: 0.01,
  });
  petals.addBinding(petalUniforms.uWhiteShare, "value", {
    label: "White share",
    min: 0,
    max: 1,
    step: 0.01,
  });
  petals.addBinding(petalUniforms.uRed, "value", {
    label: "Red",
    view: "color",
    color: { type: "float" },
  });
  petals.addBinding(petalUniforms.uWhite, "value", {
    label: "White",
    view: "color",
    color: { type: "float" },
  });
};
