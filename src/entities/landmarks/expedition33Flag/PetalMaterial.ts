import { DoubleSide, MeshBasicNodeMaterial } from "three/webgpu";
import {
  TWO_PI,
  float,
  instanceIndex,
  mix,
  positionLocal,
  rotate,
  smoothstep,
  step,
  uv,
  vec3,
} from "three/tsl";
import { petalConfig, petalUniforms } from "./config";
import {
  SEED_STREAMS,
  getLifetime,
  getPetalSeed,
  type PetalCompute,
} from "./PetalCompute";

export class PetalMaterial extends MeshBasicNodeMaterial {
  constructor(compute: PetalCompute) {
    super();
    this.side = DoubleSide;

    const petal = compute.petals.element(instanceIndex);
    const age = petal.w;
    const lifeRatio = age.div(getLifetime(instanceIndex));
    const grow = smoothstep(0, petalConfig.GROW_END, lifeRatio);
    const shrink = smoothstep(
      petalConfig.SHRINK_START,
      1,
      lifeRatio,
    ).oneMinus();

    // squared so small petals are common and big ones rare
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
      .mul(petalUniforms.uSpin);
    const rotation = tilt.add(spinRates.mul(age));
    this.positionNode = rotate(positionLocal.mul(size), rotation).add(
      petal.xyz,
    );

    const whiteSeed = getPetalSeed(instanceIndex, SEED_STREAMS.white);
    const isWhite = step(float(1).sub(petalUniforms.uWhiteShare), whiteSeed);
    const shadeSeed = getPetalSeed(instanceIndex, SEED_STREAMS.shade);
    const shade = mix(0.8, 1, shadeSeed);
    const towardTipShade = mix(0.85, 1, uv().y);
    const petalColor = mix(petalUniforms.uRed, petalUniforms.uWhite, isWhite);
    this.colorNode = petalColor.mul(shade).mul(towardTipShade);
  }
}
