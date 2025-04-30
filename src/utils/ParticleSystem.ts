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
  time,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { eventsManager } from "../systems/EventsManager";
import { rendererManager } from "../systems/RendererManager";
import {
  AddEquation,
  CustomBlending,
  InstancedMesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  SpriteNodeMaterial,
} from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import { isMeshVisible } from "./isMeshVisible";

type ParticleBuffer = ReturnType<typeof instancedArray>;

const _computeFn = Fn(([_]: [ParticleBuffer]) => {
  /* noop */
});

type ParticleComputeFn = typeof _computeFn;

type BaseParams = {
  count: number;
};

type FirePresetParams = BaseParams & {
  preset: "fire";
  speed?: number;
  radius?: number;
  height?: number;
  lifetime?: number;
  scale?: number;
  detail?: number;
  coneFactor?: number;
};

type CustomParams = BaseParams & {
  preset?: "custom";
  onUpdate: ParticleComputeFn;
  onInit?: ParticleComputeFn;
  material: SpriteNodeMaterial;
};

type ParticleParams = FirePresetParams | CustomParams;

export default class ParticleSystem extends InstancedMesh {
  readonly mainBuffer: ParticleBuffer;

  constructor(params: ParticleParams) {
    let material: SpriteNodeMaterial;
    let onInit: ParticleComputeFn | undefined;
    let onUpdate = _computeFn;

    super(new PlaneGeometry(), undefined, params.count);

    this.mainBuffer = instancedArray(params.count, "vec4"); // holds: vec4 = (x, y, z, alpha)
    this.mainBuffer.setPBO(true);

    switch (params.preset) {
      case "custom":
        material = params.material;
        onInit = params.onInit;
        onUpdate = params.onUpdate;
        break;
      case "fire":
        const fireConfig = getFirePresetConfig(params, this.mainBuffer);
        material = fireConfig.material;
        onInit = fireConfig.onInit;
        onUpdate = fireConfig.onUpdate;
        break;
      default:
        throw new Error("preset not provided for particle system");
    }

    this.material = material;

    const computeUpdate = onUpdate(this.mainBuffer).compute(params.count);
    const computeInit = onInit?.(this.mainBuffer).compute(params.count);
    if (computeInit) {
      computeUpdate?.onInit(({ renderer }) => {
        renderer.computeAsync(computeInit);
      });
    }

    eventsManager.on("update", () => {
      if (!isMeshVisible(this)) return;
      rendererManager.renderer.computeAsync(computeUpdate);
    });
  }
}

/**
 * Fire preset
 */
const getFirePresetConfig = (
  params: FirePresetParams,
  mainBuffer: ParticleBuffer,
) => {
  const {
    speed = 0.5,
    radius = 1,
    height: fireHeight = 1,
    lifetime: fireLifetime = 1,
    scale = 1,
    detail = 4,
    coneFactor = 1,
  } = params;
  const sparkHeight = fireHeight * 1.5;
  const sparkLifetime = fireLifetime * 0.75;
  const secondaryBuffer = instancedArray(params.count, "float");
  const fireParticlesPersentage = 0.95;

  const onInit = Fn(([_buffer]: [ParticleBuffer]) => {
    const rand = hash(instanceIndex.add(12345));

    const type = secondaryBuffer.element(instanceIndex);
    const isSpark = step(fireParticlesPersentage, rand);
    type.assign(isSpark);
  });

  const onUpdate = Fn(([_buffer]: [ParticleBuffer]) => {
    const data = _buffer.element(instanceIndex);
    const isSpark = secondaryBuffer.element(instanceIndex);

    const randSeed = hash(instanceIndex);

    const lifetime = mix(fireLifetime, sparkLifetime, isSpark);

    const t = time.mul(speed).add(randSeed.mul(lifetime)).mod(lifetime);
    const progress = t.div(lifetime);
    const verticalEase = float(1.0).sub(float(1.0).sub(progress).pow(2));
    const effectiveHeight = mix(fireHeight, sparkHeight, isSpark);
    const y = verticalEase.mul(effectiveHeight);

    const randAngle = hash(instanceIndex.add(7890)).mul(PI2);
    const randRadiusRaw = hash(instanceIndex.add(5678));

    const randRadius = float(1).sub(float(1).sub(randRadiusRaw).pow(2));

    const coneFalloff = float(1).sub(verticalEase.mul(coneFactor));
    const squishFactor = smoothstep(0.0, 0.35, verticalEase);
    const breathing = sin(time.mul(0.5)).mul(0.05).add(1.0);
    const effectiveRadius = mix(radius * 0.25, radius, squishFactor)
      .mul(coneFalloff)
      .mul(breathing);

    const particleRadius = randRadius.mul(effectiveRadius);
    const randSign = step(0.5, randAngle).mul(2).sub(1);
    const swirlStrength = 0.05;
    const swirlAngle = randAngle.add(
      progress.mul(PI2).mul(swirlStrength).mul(randSign),
    );

    const expansionFactor = mix(1, 0.85, isSpark);
    const wiggle = randSeed.sub(0.5).mul(0.05).mul(progress);

    const sparkExpansionProgress = smoothstep(0, 0.75, progress).mul(isSpark);
    const dynamicRadius = particleRadius.add(
      sparkExpansionProgress.mul(expansionFactor),
    );

    const x = cos(swirlAngle.add(wiggle)).mul(dynamicRadius);
    const z = sin(swirlAngle.add(wiggle)).mul(dynamicRadius);

    const fadeY = y.div(effectiveHeight);

    const fadeIn = smoothstep(0, 0.5, fadeY);
    const fadeOut = float(1).sub(smoothstep(0.5, 1, fadeY));
    const alpha = fadeIn.mul(fadeOut);

    data.assign(vec4(x, y, z, alpha));
  });

  const material = new SpriteNodeMaterial();
  material.precision = "lowp";
  material.transparent = true;
  material.depthWrite = false;
  material.blending = CustomBlending;
  material.blendEquation = AddEquation;
  material.blendSrc = OneFactor;
  material.blendDst = OneMinusSrcAlphaFactor;

  const data = mainBuffer.element(instanceIndex);
  const isSpark = secondaryBuffer.element(instanceIndex);
  const rand1 = hash(instanceIndex.add(9234));
  const rand2 = hash(instanceIndex.add(33.87));

  // Position
  material.positionNode = data.xyz;

  // Size
  const sparkScale = float(1).sub(isSpark.mul(0.85));
  const baseScale = rand2.clamp(0.25, 1);
  material.scaleNode = baseScale.mul(data.w).mul(sparkScale).mul(scale);

  // Color
  const u = step(0.5, rand1).mul(0.5);
  const v = step(0.5, rand2).mul(0.5);

  const baseUv = uv().mul(0.5);
  const fireUv = baseUv.add(vec2(u, v));
  const sample = texture(assetManager.fireSprites, fireUv, detail);

  const baseDiffuse = vec3(0.72, 0.62, 0.08).mul(2).toConst(); // gold
  const midDiffuse = vec3(1, 0.1, 0).mul(4).toConst(); // darker red
  const tipDiffuse = vec3(0).toConst(); // black

  const effectiveHeight = mix(fireHeight, sparkHeight, isSpark);
  const yFactor = smoothstep(0, 1, positionLocal.y.div(effectiveHeight)).pow(2);
  const factor1 = smoothstep(0, 0.25, yFactor);
  const mix1 = mix(baseDiffuse, midDiffuse, factor1);
  const factor2 = smoothstep(0.9, 1, yFactor);
  const fireColor = mix(mix1, tipDiffuse, factor2);
  // 0 -> additive, 1 -> normal
  const blendFactor2 = float(1).sub(smoothstep(0, 0.85, yFactor));
  const blendFactor1 = step(0.65, rand2);
  const blendFactor = blendFactor1.mul(blendFactor2);
  const alphaScale = float(0.5).toConst();
  const alphaBlend = sample.a.mul(blendFactor).mul(alphaScale);
  material.colorNode = mix(fireColor, midDiffuse, isSpark).mul(alphaBlend);

  // Opacity
  material.opacityNode = data.w.mul(sample.a).mul(alphaScale);

  return {
    material,
    onInit,
    onUpdate,
  };
};
