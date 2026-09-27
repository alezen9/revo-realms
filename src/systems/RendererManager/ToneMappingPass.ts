import { ACESFilmicToneMapping, NoToneMapping } from "three";
import type { Node } from "three/webgpu";
import {
  mix,
  renderOutput,
  toneMapping,
  toneMappingExposure,
  uniform,
  vec3,
} from "three/tsl";

const LUMINANCE_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);

export class ToneMappingPass {
  readonly saturation = uniform(1);

  apply(color: Node<"vec4">) {
    const toneMapped = toneMapping(
      ACESFilmicToneMapping,
      toneMappingExposure,
      color,
    ).rgb;
    const luminance = toneMapped.dot(LUMINANCE_WEIGHTS);
    const desaturated = mix(vec3(luminance), toneMapped, this.saturation);
    return renderOutput(desaturated, NoToneMapping);
  }
}
