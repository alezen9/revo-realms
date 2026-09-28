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
  type Node,
} from "three/webgpu";
import { assets, frustumCulling, graphics, eventBus } from "../../../systems";
import { gameTime } from "../../../systems/time/gameTime";

const SPARK_SHARE = 0.1;

type CampfireParticlesOptions = {
  count: number;
  workGroupSize?: number;
  speed?: number;
  radius?: number;
  height?: number;
  lifetime?: number;
  scale?: number;
  detail?: number;
  coneFactor?: number;
  bloom?: number;
};

const createParticleBuffer = (count: number) => instancedArray(count, "vec4");
const createSparkFlagBuffer = (count: number) => instancedArray(count, "float");

type ParticleBuffer = ReturnType<typeof createParticleBuffer>;
type SparkFlagBuffer = ReturnType<typeof createSparkFlagBuffer>;
type FloatNode = Node<"float">;

type UpdateArgs = [
  particles: ParticleBuffer,
  sparkFlags: SparkFlagBuffer,
  speed: FloatNode,
  radius: FloatNode,
  fireHeight: FloatNode,
  fireLifetime: FloatNode,
  coneFactor: FloatNode,
];

const initSparkFlags = Fn<[sparkFlags: SparkFlagBuffer], void>(
  ([sparkFlags]) => {
    const random = hash(instanceIndex.add(12345));
    sparkFlags.element(instanceIndex).assign(step(1 - SPARK_SHARE, random));
  },
);

const updateParticles = Fn<UpdateArgs, void>(
  ([
    particles,
    sparkFlags,
    speed,
    radius,
    fireHeight,
    fireLifetime,
    coneFactor,
  ]) => {
    const particle = particles.element(instanceIndex);
    const isSpark = sparkFlags.element(instanceIndex);
    const sparkHeight = fireHeight.mul(2);
    const sparkLifetime = fireLifetime.mul(0.65);

    const randomSeed = hash(instanceIndex);
    const particleSpeed = mix(speed, speed.mul(0.5), isSpark);
    const lifetime = mix(fireLifetime, sparkLifetime, isSpark);

    const age = gameTime
      .mul(particleSpeed)
      .add(randomSeed.mul(lifetime))
      .mod(lifetime);
    const progress = age.div(lifetime);
    const verticalEase = float(1).sub(float(1).sub(progress).pow(2));
    const effectiveHeight = mix(fireHeight, sparkHeight, isSpark);
    const y = verticalEase.mul(effectiveHeight);

    const randomAngle = hash(instanceIndex.add(7890)).mul(PI2);
    const randomRadius = float(1).sub(
      float(1)
        .sub(hash(instanceIndex.add(5678)))
        .pow(2),
    );

    const coneFalloff = float(1).sub(verticalEase.mul(coneFactor));
    const squish = smoothstep(0, 0.35, verticalEase);
    const breathing = sin(gameTime.mul(0.5)).mul(0.05).add(1);
    const effectiveRadius = mix(radius.mul(0.25), radius, squish)
      .mul(coneFalloff)
      .mul(breathing);

    const particleRadius = randomRadius.mul(effectiveRadius);
    const swirlSign = step(0.5, randomAngle).mul(2).sub(1);
    const swirlAngle = randomAngle.add(
      progress.mul(PI2).mul(0.05).mul(swirlSign),
    );

    const expansion = mix(1, 1.25, isSpark);
    const wiggle = randomSeed.sub(0.5).mul(0.05).mul(progress);
    const sparkExpansion = smoothstep(0, 0.75, progress).mul(isSpark);
    const dynamicRadius = particleRadius.add(sparkExpansion.mul(expansion));

    const x = cos(swirlAngle.add(wiggle)).mul(dynamicRadius);
    const z = sin(swirlAngle.add(wiggle)).mul(dynamicRadius);

    const heightProgress = y.div(effectiveHeight);
    const fadeIn = smoothstep(0, 0.5, heightProgress);
    const fadeOut = float(1).sub(smoothstep(0.5, 1, heightProgress));

    particle.assign(vec4(x, y, z, fadeIn.mul(fadeOut)));
  },
);

export class CampfireParticles extends InstancedMesh {
  // x, y, z -> position, w -> alpha
  private particles: ParticleBuffer;
  private sparkFlags: SparkFlagBuffer;
  private computeUpdate: ComputeNode;
  private isOnScreen = false;

  constructor(options: CampfireParticlesOptions) {
    const {
      count,
      workGroupSize = 1,
      speed = 0.5,
      radius = 1,
      height = 1,
      lifetime = 1,
      coneFactor = 1,
    } = options;
    super(new PlaneGeometry(), undefined, count);

    this.particles = createParticleBuffer(count);
    this.sparkFlags = createSparkFlagBuffer(count);
    this.material = this.createMaterial(options);

    const computeInit = initSparkFlags(this.sparkFlags).compute(count, [
      workGroupSize,
    ]);
    this.computeUpdate = updateParticles(
      this.particles,
      this.sparkFlags,
      float(speed),
      float(radius),
      float(height),
      float(lifetime),
      float(coneFactor),
    ).compute(count, [workGroupSize]);
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

  private createMaterial(options: CampfireParticlesOptions) {
    const { height = 1, scale = 1, detail, bloom = 1 } = options;
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
    material.scaleNode = baseScale.mul(particle.w).mul(sparkScale).mul(scale);

    const spriteCorner = vec2(
      step(0.5, firstRandom).mul(0.5),
      step(0.5, secondRandom).mul(0.5),
    );
    const sprite = texture(
      assets.resources.fireSprites,
      uv().mul(0.5).add(spriteCorner),
      detail,
    );

    const gold = vec3(0.72, 0.62, 0.08).mul(2).toConst();
    const deepRed = vec3(1, 0.1, 0).mul(4).toConst();
    const black = vec3(0).toConst();

    const effectiveHeight = mix(height, height * 2, isSpark);
    const heightFactor = smoothstep(
      0,
      1,
      positionLocal.y.div(effectiveHeight),
    ).pow(2);
    const lowerColor = mix(gold, deepRed, smoothstep(0, 0.25, heightFactor));
    const fireColor = mix(lowerColor, black, smoothstep(0.9, 1, heightFactor));
    // 0 -> additive, 1 -> normal
    const blendFactor = step(0.65, secondRandom).mul(
      float(1).sub(smoothstep(0, 0.85, heightFactor)),
    );
    const alphaScale = float(0.5).toConst();
    const alphaBlend = sprite.r.mul(blendFactor).mul(alphaScale);
    material.colorNode = mix(fireColor, deepRed, isSpark)
      .mul(alphaBlend)
      .mul(bloom);
    material.alphaTest = 0.1;
    material.opacityNode = particle.w.mul(sprite.r).mul(alphaScale);

    return material;
  }
}
