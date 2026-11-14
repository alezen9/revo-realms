import { debugPanel } from "../../systems";
import { uniforms } from "./koiConfig";

export const debugKoi = () => {
  const folder = debugPanel.panel.addFolder({
    title: "🐟 Koi",
    expanded: false,
  });
  folder.addBinding(uniforms.uDiffuseScale, "value", {
    label: "Diffuse scale",
    min: 0,
  });
};
