import {
  type DepthTexture,
  NoColorSpace,
  RedFormat,
  UnsignedByteType,
} from "three";
import {
  type ComputeNode,
  type Node,
  StorageTexture,
  type WebGPURenderer,
} from "three/webgpu";
import {
  float,
  floor,
  Fn,
  If,
  instanceIndex,
  mix,
  smoothstep,
  step,
  storageTexture,
  texture,
  textureStore,
  uniform,
  uint,
  uvec2,
  vec2,
  vec4,
} from "three/tsl";
import { realmConfig } from "../../realm/config";
import type { AssetManager } from "../AssetManager/AssetManager";
import type { LightingManager } from "../LightingManager";
import { GroundShadowLevel } from "./GroundShadowLevel";
import {
  GLOBAL_GROUND_TEXTURE_SIZE,
  groundShadowLevelSettings,
  shadowSettings,
} from "./ShadowSettings";

const getDepthVisibility = (
  sampleDepth: Node<"float">,
  receiverDepth: Node<"float">,
  isReversedDepth: boolean,
) =>
  isReversedDepth
    ? step(sampleDepth, receiverDepth)
    : step(receiverDepth, sampleDepth);

const getRegionBlend = Fn<
  [Node<"vec2">, Node<"vec2">, Node<"float">, Node<"float">],
  Node<"float">
>(([worldXZ, regionMin, regionSize, blendDistance]) => {
  const regionUv = worldXZ.sub(regionMin).div(regionSize);
  const one = float(1);
  const isInside = step(0, regionUv.x)
    .mul(step(regionUv.x, 1))
    .mul(step(0, regionUv.y))
    .mul(step(regionUv.y, 1));
  const edgeDistance = regionUv.x
    .min(one.sub(regionUv.x))
    .min(regionUv.y)
    .min(one.sub(regionUv.y));
  return smoothstep(0, blendDistance.div(regionSize), edgeDistance).mul(
    isInside,
  );
});

const getTransitionedRegionBlend = Fn<
  [
    Node<"vec2">,
    Node<"vec2">,
    Node<"vec2">,
    Node<"float">,
    Node<"float">,
    Node<"float">,
  ],
  Node<"float">
>(
  ([
    worldXZ,
    previousMin,
    currentMin,
    regionSize,
    blendDistance,
    transition,
  ]) => {
    const currentBlend = getRegionBlend(
      worldXZ,
      currentMin,
      regionSize,
      blendDistance,
    );
    const regionBlend = currentBlend.toVar();
    If(transition.lessThan(1), () => {
      const previousBlend = getRegionBlend(
        worldXZ,
        previousMin,
        regionSize,
        blendDistance,
      );
      const sharedBlend = previousBlend.min(currentBlend);
      regionBlend.assign(mix(sharedBlend, currentBlend, transition));
    });
    return regionBlend;
  },
);

const getLevelFactor = (
  worldXZ: Node<"vec2">,
  globalTexture: StorageTexture,
  levels: readonly GroundShadowLevel[],
  index: number,
): Node<"float"> => {
  if (index >= levels.length) {
    const globalUv = worldXZ
      .add(realmConfig.HALF_MAP_SIZE)
      .div(realmConfig.MAP_SIZE);
    return texture(globalTexture, globalUv).r;
  }

  const level = levels[index];
  const blend = getTransitionedRegionBlend(
    worldXZ,
    level.uPreviousMin,
    level.uMin,
    level.uSize,
    level.uBlendDistance,
    level.uTransition,
  ).mul(level.uHas);
  const ringUv = worldXZ.div(level.uSize).fract();
  const factor = float(1).toVar();
  If(blend.greaterThanEqual(1), () => {
    factor.assign(texture(level.texture, ringUv).r);
  }).Else(() => {
    const parentFactor = getLevelFactor(
      worldXZ,
      globalTexture,
      levels,
      index + 1,
    );
    If(blend.greaterThan(0), () => {
      factor.assign(mix(parentFactor, texture(level.texture, ringUv).r, blend));
    }).Else(() => {
      factor.assign(parentFactor);
    });
  });
  return factor;
};

export class GroundShadowCache {
  readonly uGeneration = uniform(0);
  readonly globalTexture = new StorageTexture(
    GLOBAL_GROUND_TEXTURE_SIZE,
    GLOBAL_GROUND_TEXTURE_SIZE,
  );
  readonly levels = groundShadowLevelSettings.map(
    (settings) => new GroundShadowLevel(settings),
  );
  private uBias = uniform(shadowSettings.bias);
  private assetManager: AssetManager;
  private lightingManager: LightingManager;
  private renderer: WebGPURenderer;
  private globalBakeCompute?: ComputeNode;

  constructor(
    renderer: WebGPURenderer,
    lightingManager: LightingManager,
    assetManager: AssetManager,
  ) {
    this.renderer = renderer;
    this.lightingManager = lightingManager;
    this.assetManager = assetManager;
    this.configureTexture(this.globalTexture, "shadows.ground");
  }

  getGroundFactor = Fn<[worldXZ: Node<"vec2">], Node<"float">>(([worldXZ]) =>
    getLevelFactor(worldXZ, this.globalTexture, this.levels, 0),
  );

  setBias(value: number) {
    this.uBias.value = value;
  }

  prepareLevel(level: GroundShadowLevel) {
    level.prepareBake();
  }

  markLevelAvailable(level: GroundShadowLevel) {
    level.markAvailable();
    this.advanceGeneration();
  }

  markGlobalAvailable() {
    this.advanceGeneration();
  }

  invalidateLevels() {
    for (const level of this.levels) level.invalidate();
  }

  update(delta: number) {
    for (const level of this.levels) level.update(delta);
  }

  resetComputes() {
    this.globalBakeCompute = undefined;
    for (const level of this.levels) level.bakeCompute = undefined;
  }

  bakeGlobal() {
    const compute = this.getBakeCompute();
    if (!compute) return false;
    this.renderer.compute(compute);
    return true;
  }

  bakeLevel(level: GroundShadowLevel) {
    const compute = this.getBakeCompute(level);
    if (!compute) return false;
    this.bakeLevelRects(level, compute);
    return true;
  }

  bakeGlobalAsync() {
    const compute = this.getBakeCompute();
    if (!compute) return Promise.resolve(false);
    return this.renderer.computeAsync(compute).then(() => true);
  }

  private configureTexture(textureValue: StorageTexture, name: string) {
    textureValue.name = name;
    textureValue.colorSpace = NoColorSpace;
    textureValue.format = RedFormat;
    textureValue.type = UnsignedByteType;
    textureValue.generateMipmaps = false;
  }

  private advanceGeneration() {
    this.uGeneration.value = (this.uGeneration.value + 1) % 65536;
  }

  private getBakeCompute(level?: GroundShadowLevel) {
    const cachedCompute = level
      ? level.bakeCompute
      : this.globalBakeCompute;
    if (cachedCompute) return cachedCompute;
    const depthTexture = this.getShadowDepthTexture();
    if (!depthTexture) return;

    const shadowMatrix = uniform(this.lightingManager.sunLight.shadow.matrix);
    const output = storageTexture(level?.texture ?? this.globalTexture);
    const textureSize =
      level?.settings.textureSize ?? GLOBAL_GROUND_TEXTURE_SIZE;
    const texel = 1 / shadowSettings.resolution;
    const isReversedDepth = this.renderer.reversedDepthBuffer;

    const compute = Fn(() => {
      const rowWidth = level ? uint(level.uBakeRectWidth) : uint(textureSize);
      const x = instanceIndex.mod(rowWidth);
      const y = instanceIndex.div(rowWidth);
      const mapUv = vec2(x, y).add(0.5).div(textureSize);
      const levelTexelSize = level
        ? level.uBakeSize.div(textureSize)
        : float(1);
      const worldXZ = level
        ? vec2(x, y).add(0.5).mul(levelTexelSize).add(level.uBakeRectMin)
        : mapUv.mul(realmConfig.MAP_SIZE).sub(realmConfig.HALF_MAP_SIZE);
      const levelCell = floor(worldXZ.div(levelTexelSize)).mod(textureSize);
      const outputCoord = level ? uvec2(levelCell) : uvec2(x, y);
      const heightMapUv = worldXZ
        .add(realmConfig.HALF_MAP_SIZE)
        .div(realmConfig.MAP_SIZE);
      const heightUv = vec2(heightMapUv.x, float(1).sub(heightMapUv.y));
      const height = texture(this.assetManager.resources.heightmap, heightUv).r;
      const projected = shadowMatrix.mul(vec4(worldXZ.x, height, worldXZ.y, 1));
      const shadowCoord = projected.xyz.div(projected.w);
      const sampleUv = vec2(shadowCoord.x, float(1).sub(shadowCoord.y));
      const compareDepth = isReversedDepth
        ? shadowCoord.z.sub(this.uBias)
        : shadowCoord.z.add(this.uBias);
      const depth = texture(depthTexture);
      const visibility = getDepthVisibility(
        depth.sample(sampleUv).r,
        compareDepth,
        isReversedDepth,
      )
        .min(
          getDepthVisibility(
            depth.sample(sampleUv.add(vec2(texel, 0))).r,
            compareDepth,
            isReversedDepth,
          ),
        )
        .min(
          getDepthVisibility(
            depth.sample(sampleUv.add(vec2(-texel, 0))).r,
            compareDepth,
            isReversedDepth,
          ),
        )
        .min(
          getDepthVisibility(
            depth.sample(sampleUv.add(vec2(0, texel))).r,
            compareDepth,
            isReversedDepth,
          ),
        )
        .min(
          getDepthVisibility(
            depth.sample(sampleUv.add(vec2(0, -texel))).r,
            compareDepth,
            isReversedDepth,
          ),
        );
      const isInside = step(0, shadowCoord.x)
        .mul(step(shadowCoord.x, 1))
        .mul(step(0, shadowCoord.y))
        .mul(step(shadowCoord.y, 1))
        .mul(step(shadowCoord.z, 1));
      const groundVisibility = mix(1, visibility, isInside);
      textureStore(output, outputCoord, vec4(groundVisibility)).toWriteOnly();
    })().compute(textureSize * textureSize, [8, 8, 1]);
    compute.name = level
      ? `${level.settings.name} ground shadow bake`
      : "Ground shadow bake";
    if (level) level.bakeCompute = compute;
    else this.globalBakeCompute = compute;
    return compute;
  }

  private getShadowDepthTexture(): DepthTexture | undefined {
    return this.lightingManager.sunLight.shadow.map?.depthTexture ?? undefined;
  }

  private bakeLevelRects(level: GroundShadowLevel, compute: ComputeNode) {
    const { textureSize } = level.settings;
    const texelSize = level.uBakeSize.value / textureSize;
    for (const rect of level.bakeRects) {
      const width = Math.round(rect.width / texelSize);
      const height = Math.round(rect.height / texelSize);
      const count = width * height;
      if (count === 0) continue;
      level.uBakeRectMin.value.set(rect.minX, rect.minZ);
      level.uBakeRectWidth.value = width;
      compute.count = count;
      this.renderer.compute(compute, count);
    }
  }
}
