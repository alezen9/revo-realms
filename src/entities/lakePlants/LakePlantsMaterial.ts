import { DoubleSide, type Texture } from "three";
import {
  float,
  hash,
  instanceIndex,
  mix,
  texture,
  transformNormalToView,
  uv,
  varying,
  vec3,
} from "three/tsl";
import { VSMReceiverLambertMaterial } from "../../systems/vsm/VSMReceiverMaterials";
import { uniforms } from "./LakePlantsConfig";

export class LakePlantsMaterial extends VSMReceiverLambertMaterial {
  constructor(diffuse: Texture, tintVariety: number) {
    super();
    this.side = DoubleSide;

    const tintRoll = varying(hash(instanceIndex)).mul(tintVariety);
    const brightnessRoll = varying(hash(instanceIndex.add(7919)))
      .mul(2)
      .sub(1)
      .mul(tintVariety);
    const tint = mix(uniforms.uTint, uniforms.uVariantTint, tintRoll);
    const brightness = float(1).add(
      brightnessRoll.mul(uniforms.uBrightnessSpread),
    );

    const plant = texture(diffuse, uv());
    this.colorNode = plant.rgb
      .mul(tint)
      .mul(brightness)
      .mul(uniforms.uDiffuseScale);
    this.opacityNode = plant.a;
    this.alphaTest = 0.4;
    this.normalNode = transformNormalToView(vec3(0, 1, 0));
  }
}
