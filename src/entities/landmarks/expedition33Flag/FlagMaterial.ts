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
import { uniforms } from "./config";
import { getParticleNormal, type FlagCompute } from "./FlagCompute";

export class FlagMaterial extends VSMReceiverLambertMaterial {
  constructor(compute: FlagCompute) {
    super();
    this.side = DoubleSide;

    this.positionNode = compute.positions.element(vertexIndex).xyz;

    // the geometry's own normal is the flat placeholder plane
    const normal = getParticleNormal(compute.positions, vertexIndex);
    const normalView = varying(transformNormalToView(normal));
    this.normalNode = normalView.normalize().mul(faceDirection);

    const designUv = vec2(uv().x, uv().y.oneMinus());
    const design = texture(
      assets.resources.expedition33FlagDiffuse,
      designUv,
    ).rgb;
    // anything clearly brighter than the black cloth is the gold design
    const isGold = step(0.25, design.r.max(design.g).max(design.b));
    this.colorNode = design.mul(uniforms.uDiffuseScale);
    this.emissiveNode = design.mul(isGold.mul(uniforms.uEmissive));
  }
}
