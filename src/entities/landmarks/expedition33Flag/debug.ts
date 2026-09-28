import { debugPanel } from "../../../systems";
import { uniforms } from "./config";

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
};
