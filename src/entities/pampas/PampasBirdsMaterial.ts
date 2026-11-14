import { DoubleSide, MeshBasicNodeMaterial } from "three/webgpu";
import {
  TWO_PI,
  instanceIndex,
  mix,
  positionLocal,
  sign,
  smoothstep,
  step,
  vec3,
} from "three/tsl";
import { birdConfig, birdUniforms } from "./pampasBirdsConfig";
import { BODY_HALF_WIDTH } from "./pampasBirdsGeometry";
import {
  SEED_STREAMS,
  getBirdSeed,
  type PampasBirdsCompute,
} from "./PampasBirdsCompute";

const { FLAP_RATE, FLAP_ANGLE, GROW_SECONDS, MAX_LIFE_SECONDS } = birdConfig;

export class PampasBirdsMaterial extends MeshBasicNodeMaterial {
  constructor(compute: PampasBirdsCompute) {
    super();
    this.side = DoubleSide;

    const bird = compute.birds.element(instanceIndex);
    const heading = compute.headings.element(instanceIndex);
    const age = bird.w;
    const grow = smoothstep(0, GROW_SECONDS, age);
    const isFlying = step(age, MAX_LIFE_SECONDS - 0.001);
    const sizeSeed = getBirdSeed(instanceIndex, SEED_STREAMS.size);
    const size = mix(birdUniforms.uMinSize, birdUniforms.uMaxSize, sizeSeed)
      .mul(grow)
      .mul(isFlying);

    const flapOffset = getBirdSeed(instanceIndex, SEED_STREAMS.flapPhase).mul(
      TWO_PI,
    );
    const flapAngle = age.mul(FLAP_RATE).add(flapOffset).sin().mul(FLAP_ANGLE);
    const side = sign(positionLocal.x);
    const wingReach = positionLocal.x.abs().sub(BODY_HALF_WIDTH).max(0);
    const bodyReach = positionLocal.x.abs().min(BODY_HALF_WIDTH);
    const flappedX = side.mul(bodyReach.add(wingReach.mul(flapAngle.cos())));
    const flappedY = wingReach.mul(flapAngle.sin());

    const forward = vec3(heading.x, 0, heading.z);
    const right = vec3(heading.z, 0, heading.x.negate());
    const flapped = right
      .mul(flappedX)
      .add(vec3(0, flappedY, 0))
      .add(forward.mul(positionLocal.z));
    this.positionNode = flapped.mul(size).add(bird.xyz);

    const tintSeed = getBirdSeed(instanceIndex, SEED_STREAMS.tint);
    const tint = mix(birdUniforms.uColor, birdUniforms.uSecondColor, tintSeed);
    const wingShade = mix(0.75, 1, wingReach.mul(flapAngle.sin().abs()));
    this.colorNode = tint.mul(wingShade).mul(birdUniforms.uDiffuseScale);
  }
}
