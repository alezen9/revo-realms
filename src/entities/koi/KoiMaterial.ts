import type { Texture } from "three";
import {
  float,
  positionLocal,
  sin,
  texture,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import { VSMReceiverLambertMaterial } from "../../systems/vsm/VSMReceiverMaterials";
import { config, uniforms } from "./koiConfig";

const { CRUISE_SWING, BODY_WAVE } = config;

export class KoiMaterial extends VSMReceiverLambertMaterial {
  readonly uSwimPhase = uniform(0);
  readonly uSwing = uniform(CRUISE_SWING);
  readonly uCurvature = uniform(0);

  constructor(coloring: Texture, headZ: number, bodyLength: number) {
    super();
    const diffuse = texture(coloring, uv());
    this.colorNode = diffuse.rgb.mul(uniforms.uDiffuseScale);

    const tailward = float(headZ).sub(positionLocal.z).div(bodyLength);
    const swing = sin(this.uSwimPhase.sub(tailward.mul(BODY_WAVE)))
      .mul(tailward.mul(tailward))
      .mul(this.uSwing);
    const bend = positionLocal.z
      .mul(positionLocal.z)
      .mul(this.uCurvature)
      .mul(0.5);
    this.positionNode = positionLocal.add(vec3(swing.add(bend), 0, 0));
  }
}
