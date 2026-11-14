import {
  cos,
  float,
  Fn,
  hash,
  instancedArray,
  instanceIndex,
  mix,
  PI2,
  sin,
  smoothstep,
  step,
  vec4,
} from "three/tsl";
import { gameTime } from "../../../systems/time/gameTime";
import { config } from "./campfireFireConfig";

const {
  COUNT,
  SPARK_SHARE,
  SPEED,
  LIFETIME,
  HEIGHT,
  CONE_FACTOR,
  RADIUS,
  WORKGROUP_SIZE,
} = config;

const createParticleBuffer = () => instancedArray(COUNT, "vec4");
const createSparkFlagBuffer = () => instancedArray(COUNT, "float");

type ParticleBuffer = ReturnType<typeof createParticleBuffer>;
type SparkFlagBuffer = ReturnType<typeof createSparkFlagBuffer>;

const initSparkFlags = Fn<[sparkFlags: SparkFlagBuffer], void>(
  ([sparkFlags]) => {
    const random = hash(instanceIndex.add(12345));
    sparkFlags.element(instanceIndex).assign(step(1 - SPARK_SHARE, random));
  },
);

const updateParticles = Fn<
  [particles: ParticleBuffer, sparkFlags: SparkFlagBuffer],
  void
>(([particles, sparkFlags]) => {
  const particle = particles.element(instanceIndex);
  const isSpark = sparkFlags.element(instanceIndex);

  const randomSeed = hash(instanceIndex);
  const particleSpeed = mix(SPEED, SPEED * 0.5, isSpark);
  const lifetime = mix(LIFETIME, LIFETIME * 0.65, isSpark);

  const ageOffset = randomSeed.mul(lifetime);
  const age = gameTime.mul(particleSpeed).add(ageOffset).mod(lifetime);
  const progress = age.div(lifetime);
  const remainingProgress = float(1).sub(progress);
  const verticalEase = float(1).sub(remainingProgress.pow(2));
  const effectiveHeight = mix(HEIGHT, HEIGHT * 2, isSpark);
  const y = verticalEase.mul(effectiveHeight);

  const randomAngle = hash(instanceIndex.add(7890)).mul(PI2);
  const radiusSeed = hash(instanceIndex.add(5678));
  const randomRadius = float(1).sub(float(1).sub(radiusSeed).pow(2));

  const coneFalloff = float(1).sub(verticalEase.mul(CONE_FACTOR));
  const squish = smoothstep(0, 0.35, verticalEase);
  const breathing = sin(gameTime.mul(0.5)).mul(0.05).add(1);
  const squishedRadius = mix(RADIUS * 0.25, RADIUS, squish);
  const effectiveRadius = squishedRadius.mul(coneFalloff).mul(breathing);

  const particleRadius = randomRadius.mul(effectiveRadius);
  const swirlSign = step(0.5, randomAngle).mul(2).sub(1);
  const swirlTurn = progress.mul(PI2).mul(0.05).mul(swirlSign);
  const swirlAngle = randomAngle.add(swirlTurn);

  const expansion = mix(1, 1.25, isSpark);
  const wiggle = randomSeed.sub(0.5).mul(0.05).mul(progress);
  const sparkExpansion = smoothstep(0, 0.75, progress).mul(isSpark);
  const dynamicRadius = particleRadius.add(sparkExpansion.mul(expansion));

  const wiggledAngle = swirlAngle.add(wiggle);
  const x = cos(wiggledAngle).mul(dynamicRadius);
  const z = sin(wiggledAngle).mul(dynamicRadius);

  const heightProgress = y.div(effectiveHeight);
  const fadeIn = smoothstep(0, 0.5, heightProgress);
  const fadeOut = float(1).sub(smoothstep(0.5, 1, heightProgress));

  particle.assign(vec4(x, y, z, fadeIn.mul(fadeOut)));
});

export class CampfireFireCompute {
  // x, y, z -> position, w -> alpha
  readonly particles = createParticleBuffer();
  readonly sparkFlags = createSparkFlagBuffer();
  readonly computeUpdate;

  constructor() {
    const computeInit = initSparkFlags(this.sparkFlags).compute(COUNT, [
      WORKGROUP_SIZE,
    ]);
    this.computeUpdate = updateParticles(
      this.particles,
      this.sparkFlags,
    ).compute(COUNT, [WORKGROUP_SIZE]);
    this.computeUpdate.name = "Campfire particles";
    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(computeInit);
    });
  }
}
