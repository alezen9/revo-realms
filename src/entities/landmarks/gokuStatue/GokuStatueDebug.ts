import type { Mesh } from "three";
import { debugPanel, graphics } from "../../../systems";
import { uniforms } from "./GokuStatueConfig";

type ShadowSettings = { depthBias: number };

export const debugGokuStatue = (
  gokuStatue: Mesh,
  shadowSettings: ShadowSettings,
) => {
  const folder = debugPanel.panel.addFolder({
    title: "🐉 Dragon Ball",
    expanded: false,
  });
  folder.addBinding(uniforms.uUvScale, "value", {
    label: "UV scale",
    min: 0,
  });
  folder.addBinding(uniforms.uDiffuseScale, "value", {
    label: "Diffuse scale",
    min: 0,
  });
  folder.addBinding(uniforms.uNormalScale, "value", {
    label: "Normal scale",
    min: 0,
  });
  folder
    .addBinding(shadowSettings, "depthBias", {
      label: "Shadow bias (m)",
      min: 0,
      max: 0.5,
      step: 0.005,
    })
    .on("change", ({ value }) => {
      graphics.vsmPass.setCasterDepthBias(gokuStatue, value);
    });
};
