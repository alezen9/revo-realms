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
  folder.addBinding(uniforms.uWindForce, "value", {
    label: "Wind force",
    min: 0,
    max: 100,
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
  folder.addBinding(uniforms.uFlutter, "value", {
    label: "Flutter",
    min: 0,
    max: 15,
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
