import {
  cos,
  float,
  Fn,
  hash,
  instancedArray,
  instanceIndex,
  mix,
  PI2,
  positionLocal,
  sin,
  smoothstep,
  step,
  texture,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  AddEquation,
  CustomBlending,
  InstancedMesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  SpriteNodeMaterial,
  type ComputeNode,
} from "three/webgpu";
import { assets, frustumCulling, graphics, eventBus } from "../../../systems";
import { gameTime } from "../../../systems/time/gameTime";

const COUNT = 2048;
const WORKGROUP_SIZE = 256;
const SPEED = 0.5;
const RADIUS = 0.85;
const HEIGHT = 1.85;
const LIFETIME = 1;
const CONE_FACTOR = 1.25;
const SCALE = 0.65;
const BLOOM = 1.5;
const SPARK_SHARE = 0.1;

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

export class Fire extends InstancedMesh {
  // x, y, z -> position, w -> alpha
  private particles = createParticleBuffer();
  private sparkFlags = createSparkFlagBuffer();
  private computeUpdate: ComputeNode;
  private isOnScreen = false;

  constructor() {
    super(new PlaneGeometry(), undefined, COUNT);
    this.material = this.createMaterial();

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

    eventBus.on("engine-render-update-throttle-64x", this.onVisibilityCheck);
    eventBus.on("engine-render-update-throttle-2x", this.onComputeUpdate);
  }

  private onVisibilityCheck = () => {
    this.isOnScreen = frustumCulling.isMeshVisible(this);
  };

  private onComputeUpdate = () => {
    if (!this.isOnScreen) return;
    graphics.renderer.compute(this.computeUpdate);
  };

  private createMaterial() {
    const material = new SpriteNodeMaterial();
    material.transparent = true;
    material.depthWrite = false;
    material.blending = CustomBlending;
    material.blendEquation = AddEquation;
    material.blendSrc = OneFactor;
    material.blendDst = OneMinusSrcAlphaFactor;

    const particle = this.particles.element(instanceIndex);
    const isSpark = this.sparkFlags.element(instanceIndex);
    const firstRandom = hash(instanceIndex.add(9234));
    const secondRandom = hash(instanceIndex.add(33.87));

    material.positionNode = particle.xyz;

    const sparkScale = float(1).sub(isSpark.mul(0.85));
    const baseScale = secondRandom.clamp(0.25, 1);
    material.scaleNode = baseScale.mul(particle.w).mul(sparkScale).mul(SCALE);

    const spriteCorner = vec2(
      step(0.5, firstRandom).mul(0.5),
      step(0.5, secondRandom).mul(0.5),
    );
    const spriteUv = uv().mul(0.5).add(spriteCorner);
    const sprite = texture(assets.resources.fireSprites, spriteUv);

    const gold = vec3(0.72, 0.62, 0.08).mul(2).toConst();
    const deepRed = vec3(1, 0.1, 0).mul(4).toConst();
    const black = vec3(0).toConst();

    const effectiveHeight = mix(HEIGHT, HEIGHT * 2, isSpark);
    const heightRatio = positionLocal.y.div(effectiveHeight);
    const heightFactor = smoothstep(0, 1, heightRatio).pow(2);
    const lowerColor = mix(gold, deepRed, smoothstep(0, 0.25, heightFactor));
    const fireColor = mix(lowerColor, black, smoothstep(0.9, 1, heightFactor));
    // 0 -> additive, 1 -> normal
    const isNormalBlend = step(0.65, secondRandom);
    const lowFlame = float(1).sub(smoothstep(0, 0.85, heightFactor));
    const blendFactor = isNormalBlend.mul(lowFlame);
    const alphaScale = float(0.5).toConst();
    const alphaBlend = sprite.r.mul(blendFactor).mul(alphaScale);
    const particleColor = mix(fireColor, deepRed, isSpark);
    material.colorNode = particleColor.mul(alphaBlend).mul(BLOOM);
    material.alphaTest = 0.1;
    material.opacityNode = particle.w.mul(sprite.r).mul(alphaScale);

    return material;
  }
}
