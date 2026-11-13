import {
  Fn,
  If,
  TWO_PI,
  cos,
  exp,
  hash,
  instanceIndex,
  instancedArray,
  mix,
  vec3,
  vec4,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { wind } from "../../../systems";
import { config, petalConfig, petalUniforms, uniforms } from "./config";
import {
  getParticleIndex,
  type FlagCompute,
  type ParticleBuffer,
} from "./FlagCompute";

const createPetalBuffer = () => instancedArray(petalConfig.COUNT, "vec4");
export type PetalBuffer = ReturnType<typeof createPetalBuffer>;

// every petal reads its own streams of the hash, so its look stays put across lives
export const SEED_STREAMS = {
  shedColumn: 0,
  shedRow: 1,
  fall: 2,
  lifetime: 3,
  wait: 4,
  size: 5,
  white: 6,
  shade: 7,
  swayFrequency: 8,
  swayPhase: 9,
  swayAngle: 10,
  swayAmount: 11,
  windCatch: 12,
  tiltX: 13,
  tiltY: 14,
  tiltZ: 15,
  spinX: 16,
  spinY: 17,
  spinZ: 18,
} as const;
// keeps a petal's next spot on the cloth unrelated to its last
const GOLDEN_RATIO_FRACTION = 0.618034;

type SeedStream = (typeof SEED_STREAMS)[keyof typeof SEED_STREAMS];

export const getPetalSeed = (index: Node<"uint">, stream: SeedStream) =>
  hash(index.add(stream * petalConfig.COUNT));

export const getLifetime = Fn<[index: Node<"uint">], Node<"float">>(([index]) =>
  mix(
    petalConfig.MIN_LIFE_SECONDS,
    petalConfig.MAX_LIFE_SECONDS,
    getPetalSeed(index, SEED_STREAMS.lifetime),
  ),
);

const getSwayPhase = Fn<
  [index: Node<"uint">, age: Node<"float">],
  Node<"float">
>(([index, age]) => {
  const frequency = mix(
    petalConfig.MIN_SWAY_FREQUENCY,
    petalConfig.MAX_SWAY_FREQUENCY,
    getPetalSeed(index, SEED_STREAMS.swayFrequency),
  );
  const offset = getPetalSeed(index, SEED_STREAMS.swayPhase).mul(TWO_PI);
  return age.mul(frequency).add(offset);
});

const getShedParticle = Fn<
  [index: Node<"uint">, lifeShift: Node<"float">],
  Node<"uint">
>(([index, lifeShift]) => {
  const columnSeed = getPetalSeed(index, SEED_STREAMS.shedColumn)
    .add(lifeShift)
    .fract();
  const widthRatio = mix(petalConfig.MIN_SHED_WIDTH_RATIO, 1, columnSeed);
  const column = widthRatio.mul(config.SEGMENTS_X).round();
  const rowSeed = getPetalSeed(index, SEED_STREAMS.shedRow)
    .add(lifeShift.mul(GOLDEN_RATIO_FRACTION))
    .fract();
  const row = rowSeed.mul(config.SEGMENTS_Y).round();
  return getParticleIndex(column, row);
});

const initPetals = Fn<[petals: PetalBuffer, motions: PetalBuffer], void>(
  ([petals, motions]) => {
    const waitSeed = getPetalSeed(instanceIndex, SEED_STREAMS.wait);
    const wait = waitSeed.mul(petalConfig.MAX_LIFE_SECONDS);
    petals.element(instanceIndex).assign(vec4(0, -100, 0, wait.negate()));
    motions.element(instanceIndex).assign(vec4(0));
  },
);

const updatePetals = Fn<
  [
    petals: PetalBuffer,
    motions: PetalBuffer,
    clothPositions: ParticleBuffer,
    clothPreviousPositions: ParticleBuffer,
  ],
  void
>(([petals, motions, clothPositions, clothPreviousPositions]) => {
  const petal = petals.element(instanceIndex);
  const motion = motions.element(instanceIndex);
  const delta = petalUniforms.uDelta;
  const age = petal.w;

  const isExpired = age.greaterThan(getLifetime(instanceIndex));
  const nextLifeShift = motion.w.add(GOLDEN_RATIO_FRACTION).fract();
  const lifeShift = isExpired.select(nextLifeShift, motion.w);
  const isOnFlag = age.lessThan(0).or(isExpired);

  If(isOnFlag, () => {
    const clothIndex = getShedParticle(instanceIndex, lifeShift);
    const clothPosition = clothPositions.element(clothIndex).xyz;
    const clothPrevious = clothPreviousPositions.element(clothIndex).xyz;
    const clothVelocity = clothPosition
      .sub(clothPrevious)
      .div(config.STEP_SECONDS);
    const spawnPosition = petalUniforms.uFlagOrigin.add(clothPosition);
    const inheritedVelocity = clothVelocity.mul(petalUniforms.uInheritedSpeed);
    const countdown = isExpired.select(0, age.add(delta)).min(0);
    petal.assign(vec4(spawnPosition, countdown));
    motion.assign(vec4(inheritedVelocity, lifeShift));
  }).Else(() => {
    const windDirection = vec3(wind.uDirection.x, 0, wind.uDirection.y);
    const windCatchSeed = getPetalSeed(instanceIndex, SEED_STREAMS.windCatch);
    const windSpeed = uniforms.uWindStrength
      .add(wind.uIntensityDirectional)
      .mul(petalUniforms.uWindSpeed)
      .mul(mix(0.7, 1.3, windCatchSeed));
    const fallSeed = getPetalSeed(instanceIndex, SEED_STREAMS.fall);
    const fallSpeed = petalUniforms.uFallSpeed.mul(mix(0.6, 1.4, fallSeed));

    const swayAngle = getPetalSeed(instanceIndex, SEED_STREAMS.swayAngle).mul(
      TWO_PI,
    );
    const swayDirection = vec3(swayAngle.cos(), 0, swayAngle.sin());
    const swayPhase = getSwayPhase(instanceIndex, age);
    const swayAmountSeed = getPetalSeed(instanceIndex, SEED_STREAMS.swayAmount);
    const swayAmount = petalUniforms.uSway.mul(mix(0.3, 1.5, swayAmountSeed));
    const sway = swayDirection.mul(cos(swayPhase).mul(swayAmount));

    const targetVelocity = windDirection
      .mul(windSpeed)
      .add(sway)
      .add(vec3(0, fallSpeed.negate(), 0));
    // easing toward the target keeps every change of wind a smooth turn
    const airBlend = exp(petalUniforms.uAirDrag.mul(delta).negate()).oneMinus();
    const velocity = mix(motion.xyz, targetVelocity, airBlend);
    const position = petal.xyz.add(velocity.mul(delta));
    petal.assign(vec4(position, age.add(delta)));
    motion.assign(vec4(velocity, motion.w));
  });
});

export class PetalCompute {
  // xyz -> world position, w -> seconds alive, negative while waiting on the flag
  readonly petals = createPetalBuffer();
  // xyz -> velocity, w -> shift of the shed spot, changes every life
  readonly motions = createPetalBuffer();
  readonly computeInit;
  readonly computeUpdate;

  constructor(flagCompute: FlagCompute) {
    this.petals.value.name = "flagPetals.petals";
    this.motions.value.name = "flagPetals.motions";
    const workgroup = [petalConfig.WORKGROUP_SIZE];
    this.computeInit = initPetals(this.petals, this.motions).compute(
      petalConfig.COUNT,
      workgroup,
    );
    this.computeUpdate = updatePetals(
      this.petals,
      this.motions,
      flagCompute.positions,
      flagCompute.previousPositions,
    ).compute(petalConfig.COUNT, workgroup);
  }
}
