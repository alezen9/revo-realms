import { DoubleSide } from "three";
import {
  faceDirection,
  step,
  texture,
  transformNormalToView,
  uv,
  varying,
  vec2,
  vertexIndex,
} from "three/tsl";
import { VSMReceiverLambertMaterial } from "../../../systems/vsm/VSMReceiverMaterials";
import { assets } from "../../../systems";
import { uniforms } from "./expedition33FlagConfig";
import {
  getParticleNormal,
  type Expedition33FlagCompute,
} from "./Expedition33FlagCompute";

export class Expedition33FlagMaterial extends VSMReceiverLambertMaterial {
  constructor(compute: Expedition33FlagCompute) {
    super();
    this.side = DoubleSide;

    this.positionNode = compute.positions.element(vertexIndex).xyz;

    const normal = getParticleNormal(compute.positions, vertexIndex);
    const normalView = varying(transformNormalToView(normal));
    this.normalNode = normalView.normalize().mul(faceDirection);

    const designUv = vec2(uv().x, uv().y.oneMinus());
    const design = texture(
      assets.resources.expedition33FlagDiffuse,
      designUv,
    ).rgb;
    const isGold = step(0.25, design.r.max(design.g).max(design.b));
    this.colorNode = design.mul(uniforms.uDiffuseScale);
    this.emissiveNode = design.mul(isGold.mul(uniforms.uEmissive));
  }
}
