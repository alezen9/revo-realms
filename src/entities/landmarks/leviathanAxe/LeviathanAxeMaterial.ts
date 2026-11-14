import { color, normalMap, texture, uv } from "three/tsl";
import { assets } from "../../../systems";
import { VSMReceiverStandardMaterial } from "../../../systems/vsm/VSMReceiverMaterials";
import { uniforms } from "./leviathanAxeConfig";

export class LeviathanAxeMaterial extends VSMReceiverStandardMaterial {
  constructor() {
    super();

    const diffuseEmission = texture(
      assets.resources.leviathanAxeDiffuseEmissive,
      uv(),
    );
    this.colorNode = diffuseEmission.rgb.mul(uniforms.uDiffuseScale);

    const emissive = color("lightblue")
      .mul(diffuseEmission.a)
      .mul(uniforms.uEmissionScale);
    this.emissiveNode = emissive;

    const normal = texture(assets.resources.leviathanAxeNormal, uv());
    this.normalNode = normalMap(normal, uniforms.uNormalScale);

    const orm = texture(assets.resources.leviathanAxeORM, uv());
    this.aoNode = orm.r.mul(uniforms.uAoScale);
    this.metalnessNode = orm.b.mul(uniforms.uMetalnessScale);
    this.roughnessNode = orm.g.mul(uniforms.uRoughnessScale);
  }
}
