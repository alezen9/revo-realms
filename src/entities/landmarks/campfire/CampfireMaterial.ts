import { normalMap, texture, uv } from "three/tsl";
import { assets } from "../../../systems";
import { VSMReceiverStandardMaterial } from "../../../systems/vsm/VSMReceiverMaterials";

export class CampfireMaterial extends VSMReceiverStandardMaterial {
  constructor() {
    super();
    const diffuse = texture(assets.resources.campfireDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(2);
    const normalRoughness = texture(
      assets.resources.campfireNormalRoughness,
      uv(),
    );
    this.normalNode = normalMap(normalRoughness.rgb);
    this.roughnessNode = normalRoughness.a;
  }
}
