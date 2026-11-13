import {
  Fn,
  attribute,
  float,
  normalMap,
  oscSine,
  positionGeometry,
  positionLocal,
  sin,
  texture,
  uv,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { assets, wind } from "../../systems";
import { gameTime } from "../../systems/time/gameTime";
import { VSMReceiverLambertMaterial } from "../../systems/vsm/VSMReceiverMaterials";
import { config, uniforms } from "./PineTreesConfig";

// the whole pine bends from its roots, so bark and canopy move together and
// the crown travels the most
const computeTrunkBend = Fn<[crownHeight: Node<"float">], Node<"vec3">>(
  ([crownHeight]) => {
    const windDirection = vec3(wind.uDirection.x, 0, wind.uDirection.y);
    const crossWindDirection = vec3(
      wind.uDirection.y.negate(),
      0,
      wind.uDirection.x,
    );
    const windTravel = positionLocal.xz
      .dot(wind.uDirection)
      .mul(config.SWAY_PHASE_PER_METER);
    const phase = gameTime.mul(uniforms.uTrunkSwaySpeed).sub(windTravel);

    const alongWindSway = windDirection.mul(sin(phase));
    const crossWindSway = crossWindDirection.mul(
      sin(phase.mul(0.7).add(1.7)).mul(0.5),
    );
    const ambientSway = alongWindSway
      .add(crossWindSway)
      .mul(uniforms.uTrunkSway);

    const gustPulse = sin(phase.mul(2)).mul(0.3).add(0.7);
    const gustLean = windDirection.mul(
      wind.uIntensityDirectional.mul(uniforms.uGustLean).mul(gustPulse),
    );

    const heightRatio = positionGeometry.y.div(crownHeight);
    return ambientSway.add(gustLean).mul(heightRatio.mul(heightRatio));
  },
);

export class PineTreesCanopyMaterial extends VSMReceiverLambertMaterial {
  constructor(crownHeight: number) {
    super();
    this.forceSinglePass = true;

    const windWeight = attribute<"float">("_windweight");

    const diffuse = texture(assets.resources.pineCanopyDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(uniforms.uCanopyDiffuseScale);
    this.opacityNode = diffuse.a;
    this.alphaTest = 0.35;
    this.alphaToCoverage = true;
    // needles are too thin and noisy for the finest shadow pages, and close up
    // they scatter page requests across the whole pool
    this.softShadowNode = float(0.5);

    const random = uv().x.mul(uv().y).mul(4);
    const profile = windWeight.mul(windWeight);
    const t = gameTime.mul(uniforms.uCanopySwaySpeed).add(random);
    const gustBoost = wind.uIntensityDirectional.add(1);
    const swayOffset = oscSine(t).mul(profile).mul(0.075).mul(gustBoost);
    this.positionNode = positionLocal
      .add(computeTrunkBend(float(crownHeight)))
      .add(vec3(0, swayOffset, 0));
  }
}

export class PineTreesBarkMaterial extends VSMReceiverLambertMaterial {
  constructor(crownHeight: number) {
    super();
    this.forceSinglePass = true;
    const _uv = uv().mul(uniforms.uBarkUvScale);
    const diffuse = texture(assets.resources.pineBarkDiffuse, _uv);
    this.colorNode = diffuse.rgb.mul(uniforms.uBarkDiffuseScale);

    const normal = texture(assets.resources.pineBarkNormal, _uv);
    this.normalNode = normalMap(normal, uniforms.uBarkNormalScale);

    this.positionNode = positionLocal.add(computeTrunkBend(float(crownHeight)));
  }
}
