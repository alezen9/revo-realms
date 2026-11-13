import { debugPanel } from "../../../systems";
import { petalUniforms, uniforms } from "./config";

export const debugExpedition33Flag = () => {
  const folder = debugPanel.panel.addFolder({
    title: "🚩 Expedition 33",
    expanded: false,
  });
  folder.addBinding(uniforms.uWindStrength, "value", {
    label: "Wind strength",
    min: 0,
    max: 2,
  });
  folder.addBinding(uniforms.uWindSpeed, "value", {
    label: "Wind speed",
    min: 0,
    max: 20,
  });
  folder.addBinding(uniforms.uDrag, "value", {
    label: "Drag",
    min: 0,
    max: 10,
  });
  folder.addBinding(uniforms.uLift, "value", {
    label: "Lift",
    min: 0,
    max: 10,
  });
  folder.addBinding(uniforms.uGustStrength, "value", {
    label: "Gust strength",
    min: 0,
    max: 1,
  });
  folder.addBinding(uniforms.uGustSpeed, "value", {
    label: "Gust speed",
    min: 0,
    max: 1,
  });
  folder.addBinding(uniforms.uGravity, "value", {
    label: "Gravity",
    min: 0,
    max: 20,
  });
  folder.addBinding(uniforms.uDamping, "value", {
    label: "Damping",
    min: 0,
    max: 8,
  });
  folder.addBinding(uniforms.uCollisionPadding, "value", {
    label: "Collision padding",
    min: 0,
    max: 1,
  });
  folder.addBinding(uniforms.uDiffuseScale, "value", {
    label: "Diffuse scale",
    min: 0,
    max: 6,
  });
  folder.addBinding(uniforms.uEmissive, "value", {
    label: "Emissive",
    min: 0,
    max: 40,
  });

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
