import { DoubleSide } from "three";
import {
  Fn,
  hash,
  instanceIndex,
  normalMap,
  PI2,
  positionLocal,
  sin,
  smoothstep,
  texture,
  uv,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { assets } from "../../systems";
import { gameTime } from "../../systems/time/gameTime";
import { VSMReceiverStandardMaterial } from "../../systems/vsm/VSMReceiverMaterials";
import { config, uniforms } from "./waterLiliesConfig";

const { BOB_SPEED, DIP_RADIUS } = config;

export const getLilyPosition = Fn<[position: Node<"vec3">], Node<"vec3">>(
  ([position]) => {
    const bobPhase = hash(instanceIndex).mul(PI2).add(gameTime.mul(BOB_SPEED));
    const bob = sin(bobPhase).mul(uniforms.uBob);
    const playerDistance = position.xz.distance(uniforms.uPlayerPosition.xz);
    const dip = smoothstep(DIP_RADIUS, 0, playerDistance)
      .mul(uniforms.uPlayerPress)
      .mul(uniforms.uDipDepth);
    return position.add(vec3(0, bob.sub(dip), 0));
  },
);

export class WaterLiliesMaterial extends VSMReceiverStandardMaterial {
  constructor() {
    super();
    this.side = DoubleSide;
    this.metalness = 0;
    this.roughnessNode = uniforms.uRoughness;

    const lily = texture(assets.resources.waterLilyDiffuse, uv());
    this.colorNode = lily.rgb.mul(uniforms.uTint).mul(uniforms.uDiffuseScale);
    this.opacityNode = lily.a;
    this.alphaTest = 0.5;

    const normal = texture(assets.resources.waterLilyNormal, uv());
    this.normalNode = normalMap(normal, uniforms.uNormalScale);

    this.positionNode = getLilyPosition(positionLocal);
  }
}
