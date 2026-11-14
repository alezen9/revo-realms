import type { Mesh } from "three";
import { debugPanel, graphics } from "../../systems";
import { uniforms } from "./lakeRocksConfig";

type ShadowSettings = { depthBias: number };

export const debugLakeRocks = (
  meshes: Mesh[],
  shadowSettings: ShadowSettings,
) => {
  const folder = debugPanel.panel.addFolder({
    title: "🪨 Lake rocks",
    expanded: false,
  });
  folder.addBinding(uniforms.uDiffuseScale, "value", {
    label: "Diffuse scale",
    min: 0,
    max: 4,
  });
  folder.addBinding(uniforms.uUvScale, "value", {
    label: "UV scale",
    min: 0.1,
    max: 8,
    step: 0.05,
  });
  folder.addBinding(uniforms.uShadeDepth, "value", {
    label: "Shade depth",
    min: 0,
    max: 1,
    step: 0.01,
  });
  folder
    .addBinding(shadowSettings, "depthBias", {
      label: "Shadow bias (m)",
      min: 0,
      max: 0.5,
      step: 0.005,
    })
    .on("change", ({ value }) => {
      for (const mesh of meshes)
        graphics.vsmPass.setCasterDepthBias(mesh, value);
    });
};
