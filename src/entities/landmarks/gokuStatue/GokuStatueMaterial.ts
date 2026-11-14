import { normalMap, texture, uv } from "three/tsl";
import { assets } from "../../../systems";
import { VSMReceiverStandardMaterial } from "../../../systems/vsm/VSMReceiverMaterials";
import { uniforms } from "./gokuStatueConfig";

export class GokuStatueMaterial extends VSMReceiverStandardMaterial {
  constructor() {
    super();

    const _uv = uv().mul(uniforms.uUvScale);
    const diffuse = texture(assets.resources.concreteDiffuse, _uv);
    this.colorNode = diffuse.rgb.mul(uniforms.uDiffuseScale);

    const normal = texture(assets.resources.concreteNormal, _uv);
    this.normalNode = normalMap(normal.rgb, uniforms.uNormalScale);
  }
}
