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
import { config, uniforms } from "./KoiConfig";

export class KoiMaterial extends VSMReceiverLambertMaterial {
  readonly uSwimPhase = uniform(0);
  readonly uSwing = uniform(config.CRUISE_SWING);
  readonly uCurvature = uniform(0);

  constructor(coloring: Texture, headZ: number, bodyLength: number) {
    super();
    const diffuse = texture(coloring, uv());
    this.colorNode = diffuse.rgb.mul(uniforms.uDiffuseScale);

    const tailward = float(headZ).sub(positionLocal.z).div(bodyLength);
    const swing = sin(this.uSwimPhase.sub(tailward.mul(config.BODY_WAVE)))
      .mul(tailward.mul(tailward))
      .mul(this.uSwing);
    // the body lies on the arc through its origin, so it sags toward the turn by distance squared over twice the radius
    const bend = positionLocal.z
      .mul(positionLocal.z)
      .mul(this.uCurvature)
      .mul(0.5);
    this.positionNode = positionLocal.add(vec3(swing.add(bend), 0, 0));
  }
}
