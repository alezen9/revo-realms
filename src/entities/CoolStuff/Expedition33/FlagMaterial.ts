import { DoubleSide } from "three";
import { mix, step, texture, uv, vec2, vertexIndex } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { assetManager } from "../../../systems";
import { uniforms } from "./config";
import type { FlagSsbo } from "./FlagSsbo";

export class FlagMaterial extends MeshBasicNodeMaterial {
  constructor(ssbo: FlagSsbo) {
    super();
    this.side = DoubleSide;

    this.positionNode = ssbo.positions.element(vertexIndex).xyz;

    const designUv = vec2(uv().x, uv().y.oneMinus());
    const design = texture(
      assetManager.resources.expedition33FlagDiffuse,
      designUv,
    ).rgb;
    // anything clearly brighter than the black cloth is the gold design
    const isGold = step(0.25, design.r.max(design.g).max(design.b));
    this.colorNode = design.mul(
      mix(uniforms.uDiffuseScale, uniforms.uEmissive, isGold),
    );
  }
}
