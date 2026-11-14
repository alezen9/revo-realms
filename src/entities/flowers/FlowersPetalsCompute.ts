import {
  Fn,
  If,
  TWO_PI,
  atomicAdd,
  cos,
  exp,
  hash,
  instanceIndex,
  instancedArray,
  mix,
  sin,
  smoothstep,
  step,
  uint,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { Node, StorageArrayElementNode } from "three/webgpu";
import { wind } from "../../systems";
import { gameTime } from "../../systems/time/gameTime";
import { petalConfig, petalUniforms } from "./flowersPetalsConfig";

const {
  COUNT,
  MIN_LIFE_SECONDS,
  MAX_LIFE_SECONDS,
  MIN_SWAY_FREQUENCY,
  MAX_SWAY_FREQUENCY,
  SHED_HEIGHT,
  SHED_RADIUS,
  MAX_PLAYER_HEIGHT,
  KICK_SPEED_LIMIT,
  CARRIED_PER_KICK_SPEED,
  PUSH_ASIDE_PER_KICK_SPEED,
  LIFT_PER_KICK_SPEED,
  GUST_LIFT,
  GUST_SCATTER,
  CALM_SHED_RATE,
  CALM_WIND,
  WIND_SPEED,
  FALL_SPEED,
  SWAY,
  AIR_DRAG,
  GUST_WAVES_PER_METER,
  GUST_WAVE_SPEED,
  WORKGROUP_SIZE,
} = petalConfig;

const createPetalBuffer = () => instancedArray(COUNT, "vec4");
const createShedCounter = () => instancedArray(1, "uint").toAtomic();
export type PetalBuffer = ReturnType<typeof createPetalBuffer>;

type ShedSource = {
  flowerIndex: Node<"uint">;
  playerOffset: Node<"vec3">;
  playerPosition: Node<"vec3">;
  terrainHeight: Node<"float">;
  grassScale: Node<"float">;
  species: Node<"float">;
};

export const SEED_STREAMS = {
  shedRoll: 0,
  shedAngle: 1,
  inherit: 5,
  lift: 6,
  fall: 7,
  lifetime: 8,
  size: 9,
  shade: 10,
  swayFrequency: 11,
  swayPhase: 12,
  swayAngle: 13,
  swayAmount: 14,
  windCatch: 15,
  tiltX: 16,
  tiltY: 17,
  tiltZ: 18,
  spinX: 19,
  spinY: 20,
  spinZ: 21,
} as const;

type SeedStream = (typeof SEED_STREAMS)[keyof typeof SEED_STREAMS];

export const getPetalSeed = (index: Node<"uint">, stream: SeedStream) =>
  hash(index.add(stream * COUNT));

export const getLifetime = Fn<[index: Node<"uint">], Node<"float">>(([index]) =>
  mix(
    MIN_LIFE_SECONDS,
    MAX_LIFE_SECONDS,
    getPetalSeed(index, SEED_STREAMS.lifetime),
  ),
);

export const shedPetalFromFlower = (
  petals: PetalBuffer,
  motions: PetalBuffer,
  shedCount: StorageArrayElementNode<"uint">,
  source: ShedSource,
) => {
  const { flowerIndex, playerOffset, playerPosition, terrainHeight } = source;
  const shedIndex = flowerIndex.add(petalUniforms.uShedSeed);

  const playerDistanceSquared = playerOffset.xz.dot(playerOffset.xz);
  const playerHeight = playerPosition.y.sub(terrainHeight);
  const isTouched = step(playerDistanceSquared, SHED_RADIUS * SHED_RADIUS).mul(
    step(playerHeight, MAX_PLAYER_HEIGHT),
  );
  const playerVelocity = petalUniforms.uPlayerVelocity;
  const playerSpeed = playerVelocity.xz.length().max(0.001);
  const kickSpeed = playerSpeed
    .div(KICK_SPEED_LIMIT)
    .negate()
    .exp()
    .oneMinus()
    .mul(KICK_SPEED_LIMIT);
  const kickShare = kickSpeed.div(playerSpeed);
  const crossingShare = petalUniforms.uPlayerStepDistance.div(SHED_RADIUS * 2);
  const touchChance = isTouched
    .mul(crossingShare)
    .mul(kickShare)
    .mul(petalUniforms.uPetalsPerFlower);

  const downwind = playerOffset.xz.dot(wind.uDirection);
  const gustPhase = downwind
    .mul(GUST_WAVES_PER_METER)
    .sub(gameTime.mul(GUST_WAVE_SPEED));
  const gustWave = smoothstep(0.3, 0.9, sin(gustPhase).mul(0.5).add(0.5));
  const gustRate = wind.uIntensityDirectional
    .mul(petalUniforms.uGustShedRate)
    .add(CALM_SHED_RATE);
  const gustChance = gustWave.mul(gustRate).mul(petalUniforms.uDelta);

  const shedRoll = getPetalSeed(shedIndex, SEED_STREAMS.shedRoll);

  If(shedRoll.lessThan(touchChance.add(gustChance)), () => {
    const slot = atomicAdd(shedCount, 1).mod(uint(COUNT));
    const awayFromPlayer = playerOffset.xz.div(
      playerDistanceSquared.sqrt().max(0.001),
    );
    const inheritSeed = getPetalSeed(shedIndex, SEED_STREAMS.inherit);
    const liftSeed = getPetalSeed(shedIndex, SEED_STREAMS.lift);
    const liftVariation = mix(0.4, 1.4, liftSeed);

    const carried = playerVelocity
      .mul(kickShare)
      .mul(mix(0.4, 1.4, inheritSeed))
      .mul(CARRIED_PER_KICK_SPEED);
    const pushedAside = awayFromPlayer.mul(
      kickSpeed.mul(PUSH_ASIDE_PER_KICK_SPEED),
    );
    const thrownUp = kickSpeed.mul(LIFT_PER_KICK_SPEED).mul(liftVariation);
    const touchKick = carried.add(vec3(pushedAside.x, thrownUp, pushedAside.y));

    const shedAngle = getPetalSeed(shedIndex, SEED_STREAMS.shedAngle).mul(
      TWO_PI,
    );
    const gustScatter = vec2(shedAngle.cos(), shedAngle.sin()).mul(
      GUST_SCATTER,
    );
    const gustLift = liftVariation.mul(GUST_LIFT);
    const gustKick = vec3(gustScatter.x, gustLift, gustScatter.y);
    const kick = mix(gustKick, touchKick, isTouched);

    const shedHeight = terrainHeight.add(source.grassScale.mul(SHED_HEIGHT));
    const position = vec3(
      playerOffset.x.add(playerPosition.x),
      shedHeight,
      playerOffset.z.add(playerPosition.z),
    );
    petals.element(slot).assign(vec4(position, 0));
    motions.element(slot).assign(vec4(kick, source.species));
  });
};

const initPetals = Fn<[petals: PetalBuffer, motions: PetalBuffer], void>(
  ([petals, motions]) => {
    petals.element(instanceIndex).assign(vec4(0, -100, 0, MAX_LIFE_SECONDS));
    motions.element(instanceIndex).assign(vec4(0));
  },
);

const updatePetals = Fn<[petals: PetalBuffer, motions: PetalBuffer], void>(
  ([petals, motions]) => {
    const petal = petals.element(instanceIndex);
    const motion = motions.element(instanceIndex);
    const delta = petalUniforms.uDelta;
    const age = petal.w;

    const isFlying = age.lessThan(getLifetime(instanceIndex));

    If(isFlying, () => {
      const windDirection = vec3(wind.uDirection.x, 0, wind.uDirection.y);
      const windCatchSeed = getPetalSeed(instanceIndex, SEED_STREAMS.windCatch);
      const windSpeed = wind.uIntensityDirectional
        .add(CALM_WIND)
        .mul(WIND_SPEED)
        .mul(mix(0.7, 1.3, windCatchSeed));
      const fallSeed = getPetalSeed(instanceIndex, SEED_STREAMS.fall);
      const fallSpeed = mix(0.6, 1.4, fallSeed).mul(FALL_SPEED);

      const swayAngle = getPetalSeed(instanceIndex, SEED_STREAMS.swayAngle).mul(
        TWO_PI,
      );
      const swayDirection = vec3(swayAngle.cos(), 0, swayAngle.sin());
      const swayFrequency = mix(
        MIN_SWAY_FREQUENCY,
        MAX_SWAY_FREQUENCY,
        getPetalSeed(instanceIndex, SEED_STREAMS.swayFrequency),
      );
      const swayOffset = getPetalSeed(
        instanceIndex,
        SEED_STREAMS.swayPhase,
      ).mul(TWO_PI);
      const swayPhase = age.mul(swayFrequency).add(swayOffset);
      const swayAmountSeed = getPetalSeed(
        instanceIndex,
        SEED_STREAMS.swayAmount,
      );
      const swayAmount = mix(0.3, 1.5, swayAmountSeed).mul(SWAY);
      const sway = swayDirection.mul(cos(swayPhase).mul(swayAmount));

      const targetVelocity = windDirection
        .mul(windSpeed)
        .add(sway)
        .add(vec3(0, fallSpeed.negate(), 0));
      const airBlend = exp(delta.mul(-AIR_DRAG)).oneMinus();
      const velocity = mix(motion.xyz, targetVelocity, airBlend);
      const position = petal.xyz.add(velocity.mul(delta));
      petal.assign(vec4(position, age.add(delta)));
      motion.assign(vec4(velocity, motion.w));
    });
  },
);

export class FlowersPetalsCompute {
  // xyz -> world position, w -> seconds alive, a full life or more means not flying
  readonly petals = createPetalBuffer();
  // xyz -> velocity, w -> species
  readonly motions = createPetalBuffer();
  readonly shedCounter = createShedCounter();
  readonly computeInit;
  readonly computeUpdate;

  constructor() {
    this.petals.value.name = "flowersPetals.petals";
    this.motions.value.name = "flowersPetals.motions";
    const workgroup = [WORKGROUP_SIZE];
    this.computeInit = initPetals(this.petals, this.motions).compute(
      COUNT,
      workgroup,
    );
    this.computeUpdate = updatePetals(this.petals, this.motions).compute(
      COUNT,
      workgroup,
    );
  }
}
