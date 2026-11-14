import { debugPanel } from "../../systems";
import { srgbColorTarget } from "../../systems/debug/tweakpaneColor";
import { uniforms } from "./terrainConfig";

export const debugTerrain = () => {
  const folder = debugPanel.panel.addFolder({
    title: "⛰️ Terrain",
    expanded: false,
  });
  const color = folder.addFolder({
    title: "Color",
  });
  color.addBinding(srgbColorTarget(uniforms.uGrassGroundColor.value), "value", {
    label: "Grass ground",
    view: "color",
    color: { type: "float" },
  });
  color.addBinding(srgbColorTarget(uniforms.uSandColor.value), "value", {
    label: "Sand",
    view: "color",
    color: { type: "float" },
  });
  color.addBinding(
    srgbColorTarget(uniforms.uUnderwaterSandColor.value),
    "value",
    {
      label: "Underwater sand",
      view: "color",
      color: { type: "float" },
    },
  );
  const normal = folder.addFolder({
    title: "Normal scale",
  });
  normal.addBinding(uniforms.uSandNormalScale, "value", {
    label: "Sand",
  });
  normal.addBinding(uniforms.uGrassNormalScale, "value", {
    label: "Grass",
  });
  normal.addBinding(uniforms.uWaterNormalScale, "value", {
    label: "Water",
  });
  const caustics = folder.addFolder({
    title: "Caustics",
  });
  caustics.addBinding(uniforms.uCausticsUv1Scale, "value", {
    label: "UV 1 scale",
    min: 0,
    max: 100,
    step: 0.001,
  });
  caustics.addBinding(uniforms.uCausticsUv2Scale, "value", {
    label: "UV 2 scale",
    min: 0,
    max: 100,
    step: 0.001,
  });
  caustics.addBinding(uniforms.uCausticsHighlightScale, "value", {
    label: "Highlight scale",
    min: 0,
    max: 1,
    step: 0.001,
  });
};
