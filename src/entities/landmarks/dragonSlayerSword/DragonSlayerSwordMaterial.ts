import { normalMap, texture, uv } from "three/tsl";
import { assets } from "../../../systems";
import { VSMReceiverStandardMaterial } from "../../../systems/vsm/VSMReceiverMaterials";
import { uniforms } from "./dragonSlayerSwordConfig";

export class DragonSlayerSwordMaterial extends VSMReceiverStandardMaterial {
  constructor() {
    super();
    const diffuse = texture(assets.resources.dragonSlayerSwordDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(uniforms.uDiffuseScale);
    const normal = texture(assets.resources.dragonSlayerSwordNormal, uv());
    this.normalNode = normalMap(normal.rgb, uniforms.uNormalScale);

    const orm = texture(assets.resources.dragonSlayerSwordARM, uv());
    this.aoNode = orm.r.mul(uniforms.uAoScale);
    this.metalnessNode = orm.b.mul(uniforms.uMetalnessScale);
    this.roughnessNode = orm.g.mul(uniforms.uRoughnessScale);
  }
}
