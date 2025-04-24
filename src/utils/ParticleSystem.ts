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
  radius?: number;
  height?: number;
  lifetime?: number;
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
    radius = 1,
    height: fireHeight = 1,
    lifetime: fireLifetime = 1.5,
  } = params;
  const sparkHeight = fireHeight * 2;
  const sparkLifetime = fireLifetime * 0.75;
  const secondaryBuffer = instancedArray(params.count, "float");
  const fireParticlesPersentage = 0.95;

  const onInit = Fn(([_buffer]: [ParticleBuffer]) => {
    const data = _buffer.element(instanceIndex);
    const rand = hash(instanceIndex.add(12345));
    const jitter = rand.mul(radius).sub(radius / 2);
    data.assign(vec4(jitter, 0, jitter, 1));

    const type = secondaryBuffer.element(instanceIndex);
    const isSpark = step(fireParticlesPersentage, rand);
    type.assign(isSpark);
  });

  const onUpdate = Fn(([_buffer]: [ParticleBuffer]) => {
    const data = _buffer.element(instanceIndex);
    const isSpark = secondaryBuffer.element(instanceIndex);

    const randSeed = hash(instanceIndex);

    const lifetime = mix(fireLifetime, sparkLifetime, isSpark);
    const t = time.mul(0.5).mod(lifetime);
    const offset = randSeed.mul(lifetime);
    const localTime = t.add(offset).mod(lifetime);

    const progress = localTime.div(lifetime);
    // start fast, slow down: y = 1 - (1 - progress)^2
    const verticalEase = float(1.0).sub(float(1.0).sub(progress).pow(2));
    const effectiveHeight = mix(fireHeight, sparkHeight, isSpark);
    const y = verticalEase.mul(effectiveHeight);

    const randX = hash(instanceIndex.add(101));
    const randZ = hash(instanceIndex.add(202));

    const baseFrequency = float(2);
    const freqX = randX.mul(baseFrequency).add(baseFrequency);
    const freqZ = randZ.mul(baseFrequency).add(baseFrequency);

    const phaseX = progress.mul(freqX).add(randX.mul(PI2));
    const phaseZ = progress.mul(freqZ).add(randZ.mul(PI2));

    const sparkPhase = float(0.05).mul(y).mul(isSpark);
    const coneFalloff = float(1).sub(verticalEase); // 1 at bottom, 0 at top
    const radiusFalloff = coneFalloff.mul(radius);

    const x = sin(phaseX)
      .mul(randX.mul(0.15).add(0.15).add(sparkPhase))
      .mul(radiusFalloff);

    const z = cos(phaseZ)
      .mul(randZ.mul(0.15).add(0.15).add(sparkPhase))
      .mul(radiusFalloff);

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
  material.scaleNode = rand1.mul(data.w).mul(sparkScale);

  // Color
  const u = step(0.5, rand1).mul(0.5);
  const v = step(0.5, rand2).mul(0.5);

  const baseUv = uv().mul(0.5);
  const fireUv = baseUv.add(vec2(u, v));
  const sample = texture(assetManager.fireSprites, fireUv, 4);

  const baseDiffuse = vec3(0.72, 0.62, 0.08).mul(2).toConst(); // gold
  const midDiffuse = vec3(1, 0.1, 0).mul(4).toConst(); // darker red
  const tipDiffuse = vec3(0).toConst(); // black

  const effectiveHeight = mix(fireHeight, sparkHeight, isSpark);
  const yFactor = smoothstep(0, 1, positionLocal.y.div(effectiveHeight)).pow(2);
  const factor1 = smoothstep(0, 0.2, yFactor);
  const mix1 = mix(baseDiffuse, midDiffuse, factor1);
  const factor2 = smoothstep(0.9, 1, yFactor);
  const fireColor = mix(mix1, tipDiffuse, factor2);
  // 0 -> additive, 1 -> normal
  const blendFactor = float(1).sub(smoothstep(0, 0.5, yFactor));
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
