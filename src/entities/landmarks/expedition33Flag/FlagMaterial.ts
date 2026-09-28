import { DoubleSide } from "three";
import { mix, step, texture, uv, vec2, vertexIndex } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { assets } from "../../../systems";
import { uniforms } from "./config";
import type { FlagCompute } from "./FlagCompute";

export class FlagMaterial extends MeshBasicNodeMaterial {
  constructor(compute: FlagCompute) {
    super();
    this.side = DoubleSide;

    this.positionNode = compute.positions.element(vertexIndex).xyz;

    const designUv = vec2(uv().x, uv().y.oneMinus());
    const design = texture(
      assets.resources.expedition33FlagDiffuse,
      designUv,
    ).rgb;
    // anything clearly brighter than the black cloth is the gold design
    const isGold = step(0.25, design.r.max(design.g).max(design.b));
    this.colorNode = design.mul(
      mix(uniforms.uDiffuseScale, uniforms.uEmissive, isGold),
    );
  }
}
