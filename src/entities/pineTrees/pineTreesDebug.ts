import { debugPanel } from "../../systems";
import { uniforms } from "./pineTreesConfig";

export const debugPineTrees = () => {
  const folder = debugPanel.panel.addFolder({
    title: "🌲 Pine Trees",
    expanded: false,
  });
  const canopy = folder.addFolder({
    title: "Canopy",
  });
  canopy.addBinding(uniforms.uCanopyDiffuseScale, "value", {
    label: "Diffuse scale",
    min: 0,
  });
  canopy.addBinding(uniforms.uCanopySwaySpeed, "value", {
    label: "Sway speed",
    min: 0,
  });

  const bark = folder.addFolder({
    title: "Bark",
  });

  bark.addBinding(uniforms.uBarkUvScale, "value", {
    label: "UV scale",
    min: 0,
  });
  bark.addBinding(uniforms.uBarkDiffuseScale, "value", {
    label: "Diffuse scale",
    min: 0,
  });
  bark.addBinding(uniforms.uBarkNormalScale, "value", {
    label: "Normal scale",
    min: 0,
  });

  const trunk = folder.addFolder({
    title: "Trunk",
  });
  trunk.addBinding(uniforms.uTrunkSwaySpeed, "value", {
    label: "Sway speed",
    min: 0,
  });
  trunk.addBinding(uniforms.uTrunkSway, "value", {
    label: "Sway",
    min: 0,
  });
  trunk.addBinding(uniforms.uGustLean, "value", {
    label: "Gust lean",
    min: 0,
  });
};
