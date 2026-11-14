import { DoubleSide, MeshBasicNodeMaterial } from "three/webgpu";
import {
  TWO_PI,
  instanceIndex,
  mix,
  positionLocal,
  rotate,
  smoothstep,
  step,
  uv,
  varying,
  vec3,
} from "three/tsl";
import { lighting } from "../../systems";
import { uniforms } from "./flowersConfig";
import { petalConfig, petalUniforms } from "./flowersPetalsConfig";
import {
  SEED_STREAMS,
  getLifetime,
  getPetalSeed,
  type FlowersPetalsCompute,
} from "./FlowersPetalsCompute";

const { GROW_END, SHRINK_START, SPIN, GLINT_SHARPNESS } = petalConfig;

export class FlowersPetalsMaterial extends MeshBasicNodeMaterial {
  constructor(compute: FlowersPetalsCompute) {
    super();
    this.side = DoubleSide;

    const petal = compute.petals.element(instanceIndex);
    const age = petal.w;
    const lifeRatio = age.div(getLifetime(instanceIndex));
    const grow = smoothstep(0, GROW_END, lifeRatio);
    const shrink = smoothstep(SHRINK_START, 1, lifeRatio).oneMinus();

    const sizeSeed = getPetalSeed(instanceIndex, SEED_STREAMS.size);
    const sizeVariation = mix(0.6, 1.4, sizeSeed.mul(sizeSeed));
    const size = petalUniforms.uSize.mul(sizeVariation).mul(grow).mul(shrink);

    const tilt = vec3(
      getPetalSeed(instanceIndex, SEED_STREAMS.tiltX),
      getPetalSeed(instanceIndex, SEED_STREAMS.tiltY),
      getPetalSeed(instanceIndex, SEED_STREAMS.tiltZ),
    ).mul(TWO_PI);
    const spinRates = vec3(
      getPetalSeed(instanceIndex, SEED_STREAMS.spinX),
      getPetalSeed(instanceIndex, SEED_STREAMS.spinY),
      getPetalSeed(instanceIndex, SEED_STREAMS.spinZ),
    )
      .mul(2)
      .sub(1)
      .mul(SPIN);
    const rotation = tilt.add(spinRates.mul(age));
    this.positionNode = rotate(positionLocal.mul(size), rotation).add(
      petal.xyz,
    );

    const species = compute.motions.element(instanceIndex).w;
    const speciesColor = mix(
      mix(
        mix(uniforms.uColor1, uniforms.uColor2, step(0.5, species)),
        uniforms.uColor3,
        step(1.5, species),
      ),
      uniforms.uColor4,
      step(2.5, species),
    );
    const shadeSeed = getPetalSeed(instanceIndex, SEED_STREAMS.shade);
    const shade = mix(0.8, 1, shadeSeed);
    const towardTipShade = mix(0.85, 1, uv().y);
    const facing = varying(rotate(vec3(0, 0, 1), rotation));
    const sunFacing = facing.normalize().dot(lighting.uSunDir).abs();
    const glint = sunFacing.pow(GLINT_SHARPNESS).mul(petalUniforms.uGlint);
    this.colorNode = speciesColor
      .mul(shade)
      .mul(towardTipShade)
      .mul(uniforms.uBrightness)
      .mul(glint.add(1));
  }
}
