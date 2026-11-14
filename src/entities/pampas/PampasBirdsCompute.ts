import {
  Fn,
  If,
  Loop,
  TWO_PI,
  atomicAdd,
  float,
  hash,
  instanceIndex,
  instancedArray,
  mix,
  smoothstep,
  step,
  texture,
  uint,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { Node, StorageArrayElementNode } from "three/webgpu";
import { assets, stage } from "../../systems";
import { computeFrustumVisibility } from "../../shaders/frustum";
import { computeMapUvByPosition } from "../../shaders/mapping";
import { gameTime } from "../../systems/time/gameTime";
import { birdConfig, birdUniforms } from "./pampasBirdsConfig";
import { config as pampasConfig } from "./pampasConfig";

const {
  COUNT,
  WORKGROUP_SIZE,
  MAX_LIFE_SECONDS,
  MIN_OFFSCREEN_SECONDS,
  MIN_COOLDOWN_SECONDS,
  MAX_COOLDOWN_SECONDS,
  MAX_BIRDS_PER_CLUMP,
  FLUSH_RADIUS,
  FLUSH_HEIGHT,
  FLUSH_SPREAD,
  FLUSH_ALONG_PLAYER,
  BURST_SPEED,
  CRUISE_SPEED,
  SETTLE_SECONDS,
  RISE_SECONDS,
  MIN_CLIMB_SPEED,
  MAX_CLIMB_SPEED,
  MAX_TURN_RATE,
} = birdConfig;

const { CLUMP_RADIUS } = pampasConfig;
const CLUMP_COUNT = pampasConfig.COUNT / pampasConfig.PLANTS_PER_CLUMP;

const createBirdBuffer = () => instancedArray(COUNT, "vec4");
const createNestBuffer = () => instancedArray(CLUMP_COUNT, "float");
const createFlushCounter = () => instancedArray(1, "uint").toAtomic();
export type BirdBuffer = ReturnType<typeof createBirdBuffer>;
export type NestBuffer = ReturnType<typeof createNestBuffer>;

export const SEED_STREAMS = {
  cooldown: 0,
  count: 1,
  flushAngle: 2,
  speed: 3,
  climb: 4,
  turn: 5,
  flapPhase: 6,
  size: 7,
  tint: 8,
} as const;

type SeedStream = (typeof SEED_STREAMS)[keyof typeof SEED_STREAMS];

type FlushSource = {
  clumpIndex: Node<"uint">;
  isClumpKeeper: Node<"bool">;
  playerOffset: Node<"vec2">;
  playerPosition: Node<"vec3">;
  terrainHeight: Node<"float">;
  plantHeight: number;
};

export const getBirdSeed = (index: Node<"uint">, stream: SeedStream) =>
  hash(index.add(stream * COUNT));

export const flushBirdsFromClump = (
  birds: BirdBuffer,
  headings: BirdBuffer,
  nests: NestBuffer,
  flushCount: StorageArrayElementNode<"uint">,
  source: FlushSource,
) => {
  const { clumpIndex, playerOffset, playerPosition, terrainHeight } = source;
  const readyAt = nests.element(clumpIndex);
  const playerDistance = playerOffset.length();
  const playerHeight = playerPosition.y.sub(terrainHeight);
  const isTouched = playerDistance
    .lessThan(FLUSH_RADIUS)
    .and(playerHeight.lessThan(source.plantHeight));
  const isReady = gameTime.greaterThanEqual(readyAt);

  If(source.isClumpKeeper.and(isTouched).and(isReady), () => {
    const flushIndex = clumpIndex.add(uint(gameTime).mul(CLUMP_COUNT));
    const cooldown = mix(
      MIN_COOLDOWN_SECONDS,
      MAX_COOLDOWN_SECONDS,
      getBirdSeed(flushIndex, SEED_STREAMS.cooldown),
    );
    readyAt.assign(gameTime.add(cooldown));

    const countRoll = getBirdSeed(flushIndex, SEED_STREAMS.count);
    const birdCount = uint(countRoll.mul(MAX_BIRDS_PER_CLUMP + 1));
    const awayFromPlayer = playerOffset.div(playerDistance.max(0.001));
    const playerVelocity = birdUniforms.uPlayerVelocity.xz;
    const playerDirection = playerVelocity.div(
      playerVelocity.length().max(0.001),
    );
    const clumpPosition = playerOffset.add(playerPosition.xz);

    Loop(
      { start: 0, end: MAX_BIRDS_PER_CLUMP, type: "uint" },
      ({ i: birdSlot }) => {
        If(birdSlot.lessThan(birdCount), () => {
          const slot = atomicAdd(flushCount, 1).mod(uint(COUNT));
          const birdIndex = flushIndex.add(birdSlot.mul(7919));
          const flushAngle = getBirdSeed(
            birdIndex,
            SEED_STREAMS.flushAngle,
          ).mul(TWO_PI);
          const spread = vec2(flushAngle.cos(), flushAngle.sin());
          const heading = awayFromPlayer
            .add(playerDirection.mul(FLUSH_ALONG_PLAYER))
            .add(spread.mul(FLUSH_SPREAD))
            .normalize();
          const position = clumpPosition.add(spread.mul(CLUMP_RADIUS));

          birds
            .element(slot)
            .assign(
              vec4(position.x, terrainHeight.add(FLUSH_HEIGHT), position.y, 0),
            );
          headings.element(slot).assign(vec4(heading.x, 0, heading.y, 0));
        });
      },
    );
  });
};

const initBirds = Fn<[birds: BirdBuffer, headings: BirdBuffer], void>(
  ([birds, headings]) => {
    birds.element(instanceIndex).assign(vec4(0, -100, 0, MAX_LIFE_SECONDS));
    headings.element(instanceIndex).assign(vec4(0, 0, 1, 0));
  },
);

const updateBirds = Fn<[birds: BirdBuffer, headings: BirdBuffer], void>(
  ([birds, headings]) => {
    const bird = birds.element(instanceIndex);
    const heading = headings.element(instanceIndex);
    const delta = birdUniforms.uDelta;
    const age = bird.w;

    If(age.lessThan(MAX_LIFE_SECONDS), () => {
      const turnSeed = getBirdSeed(instanceIndex, SEED_STREAMS.turn);
      const turnRate = turnSeed.mul(2).sub(1).mul(MAX_TURN_RATE);
      const sideways = vec2(heading.z, heading.x.negate());
      const nextHeading = heading.xz
        .add(sideways.mul(turnRate.mul(delta)))
        .normalize();

      const speedSeed = getBirdSeed(instanceIndex, SEED_STREAMS.speed);
      const settle = smoothstep(0, SETTLE_SECONDS, age);
      const speed = mix(BURST_SPEED, CRUISE_SPEED, settle).mul(
        mix(0.8, 1.2, speedSeed),
      );
      const positionXZ = bird.xz.add(nextHeading.mul(speed.mul(delta)));

      const mapUv = computeMapUvByPosition(positionXZ);
      const heightUv = vec2(mapUv.x, float(1).sub(mapUv.y));
      const terrainHeight = texture(assets.resources.heightmap, heightUv).r;
      const climbSpeed = mix(
        MIN_CLIMB_SPEED,
        MAX_CLIMB_SPEED,
        getBirdSeed(instanceIndex, SEED_STREAMS.climb),
      );
      const rise = smoothstep(0, RISE_SECONDS, age);
      const height = climbSpeed.mul(age).mul(rise).add(FLUSH_HEIGHT);
      const position = vec3(
        positionXZ.x,
        terrainHeight.add(height),
        positionXZ.y,
      );

      const clipPosition = stage.uCameraMatrix.mul(vec4(position, 1));
      const isOnScreen = computeFrustumVisibility(
        clipPosition,
        stage.uFx,
        stage.uFy,
        birdUniforms.uMaxSize,
        float(0),
        float(0),
        float(0),
      );
      const hasLeftView = step(isOnScreen, 0.5).mul(
        step(MIN_OFFSCREEN_SECONDS, age),
      );
      const nextAge = mix(age.add(delta), MAX_LIFE_SECONDS, hasLeftView);

      bird.assign(vec4(position, nextAge));
      heading.assign(vec4(nextHeading.x, 0, nextHeading.y, 0));
    });
  },
);

export class PampasBirdsCompute {
  // xyz -> world position, w -> seconds alive, a full life or more means not flying
  readonly birds = createBirdBuffer();
  // xz -> unit flight direction
  readonly headings = createBirdBuffer();
  // game time at which each clump can flush birds again
  readonly nests = createNestBuffer();
  readonly flushCounter = createFlushCounter();
  readonly computeInit;
  readonly computeUpdate;

  constructor() {
    this.birds.value.name = "pampasBirds.birds";
    this.headings.value.name = "pampasBirds.headings";
    const workgroup = [WORKGROUP_SIZE];
    this.computeInit = initBirds(this.birds, this.headings).compute(
      COUNT,
      workgroup,
    );
    this.computeUpdate = updateBirds(this.birds, this.headings).compute(
      COUNT,
      workgroup,
    );
  }
}
