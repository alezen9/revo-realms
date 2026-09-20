import {
  attribute,
  oscSine,
  positionLocal,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import { gameTime } from "../../utils/GameTime";

export const PINE_CANOPY_ALPHA_TEST = 0.35;
export const PINE_CANOPY_MAXIMUM_SWAY = 0.1;

export const pineCanopyUniforms = {
  uDiffuseScale: uniform(0.6),
  uSwaySpeed: uniform(0.75),
};

export const getPineCanopyPosition = () => {
  const windWeight = attribute<"float">("_windweight");
  const random = uv().x.mul(uv().y).mul(4);
  const profile = windWeight.mul(windWeight);
  const time = gameTime.mul(pineCanopyUniforms.uSwaySpeed).add(random);
  const swayOffset = oscSine(time).mul(profile).mul(PINE_CANOPY_MAXIMUM_SWAY);
  return positionLocal.add(vec3(0, swayOffset, 0));
};
