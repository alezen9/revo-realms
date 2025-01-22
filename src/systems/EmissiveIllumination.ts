import { Color, Vector3 } from "three";
import {
  dot,
  float,
  Fn,
  max,
  normalWorld,
  positionWorld,
  uniform,
  vec3,
} from "three/tsl";

type Emitter = {
  position: Vector3;
  hue: Color;
  intensity: number;
};

type EmitterUniforms = {
  [Key in keyof Emitter]: ReturnType<typeof uniform<Emitter[Key]>>;
};
export default class EmissiveIllumination {
  private emitters: EmitterUniforms[] = [];

  registerEmitter(emitter: Emitter) {
    this.emitters.push({
      position: uniform(emitter.position),
      hue: uniform(emitter.hue),
      intensity: uniform(emitter.intensity),
    });
  }

  // Mid-Simple version
  private material_computeSingleEmissiveLight = Fn(
    ({ position = vec3(0, 0, 0), hue = vec3(1, 0, 0), intensity = 10 }) => {
      const surfaceToLight = position.sub(positionWorld);
      const distance = surfaceToLight.length();

      const attenuation = float(1.0).div(
        float(1.0).add(distance.mul(0.3).add(distance.pow(2).mul(0.5))),
      );

      // Diffuse wrapping for smoother shading
      const wrapFactor = 0.5; // Controls blending softness (0 = sharp, 1 = very smooth)
      const emissiveDirection = surfaceToLight.normalize();
      const emissiveShading = max(
        0,
        dot(normalWorld, emissiveDirection)
          .mul(1.0 - wrapFactor)
          .add(wrapFactor),
      );

      return hue.mul(intensity).mul(emissiveShading).mul(attenuation);
    },
  );

  material_computeEmissiveLight = Fn(() => {
    let cumulativeContribution = vec3(0);
    for (const emitter of this.emitters) {
      const contribution = this.material_computeSingleEmissiveLight(emitter);
      cumulativeContribution = cumulativeContribution.add(contribution);
    }
    return cumulativeContribution;
  });
}
