import {
  type DepthTexture,
  NoColorSpace,
  RedFormat,
  RepeatWrapping,
  UnsignedByteType,
  Vector2,
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
import {
  GLOBAL_GROUND_TEXTURE_SIZE,
  LOCAL_GROUND_TEXTURE_SIZE,
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

type LocalBakeRect = {
  height: number;
  minX: number;
  minZ: number;
  width: number;
};

export class GroundShadowCache {
  readonly uGeneration = uniform(0);
  readonly globalTexture = new StorageTexture(
    GLOBAL_GROUND_TEXTURE_SIZE,
    GLOBAL_GROUND_TEXTURE_SIZE,
  );
  readonly localTexture = new StorageTexture(
    LOCAL_GROUND_TEXTURE_SIZE,
    LOCAL_GROUND_TEXTURE_SIZE,
  );
  private uBias = uniform(shadowSettings.bias);
  private uHasLocal = uniform(0);
  private uPreviousLocalMin = uniform(new Vector2());
  private uLocalMin = uniform(new Vector2());
  private uLocalSize = uniform(shadowSettings.localSize);
  private uLocalTransition = uniform(1);
  private uLocalBakeMin = uniform(new Vector2());
  private uLocalBakeSize = uniform(shadowSettings.localSize);
  private uLocalBakeRectMin = uniform(new Vector2());
  private uLocalBakeRectWidth = uniform(LOCAL_GROUND_TEXTURE_SIZE);
  private uLocalBlendDistance = uniform(shadowSettings.localBlendDistance);
  private assetManager: AssetManager;
  private lightingManager: LightingManager;
  private renderer: WebGPURenderer;
  private globalBakeCompute?: ComputeNode;
  private localBakeCompute?: ComputeNode;
  private localBakeRects: LocalBakeRect[] = [];
  private isLocalValid = false;
  private canTransitionLocal = false;

  constructor(
    renderer: WebGPURenderer,
    lightingManager: LightingManager,
    assetManager: AssetManager,
  ) {
    this.renderer = renderer;
    this.lightingManager = lightingManager;
    this.assetManager = assetManager;
    this.configureTexture(this.globalTexture, "shadows.ground");
    this.configureTexture(this.localTexture, "shadows.ground.local");
    this.localTexture.wrapS = RepeatWrapping;
    this.localTexture.wrapT = RepeatWrapping;
  }

  getGroundFactor = Fn<[worldXZ: Node<"vec2">], Node<"float">>(
    ([worldXZ]) => {
      const globalUv = worldXZ
        .add(realmConfig.HALF_MAP_SIZE)
        .div(realmConfig.MAP_SIZE);
      const globalFactor = texture(this.globalTexture, globalUv).r;
      const currentBlend = getRegionBlend(
        worldXZ,
        this.uLocalMin,
        this.uLocalSize,
        this.uLocalBlendDistance,
      );
      const localBlend = currentBlend.toVar();
      If(this.uLocalTransition.lessThan(1), () => {
        const previousBlend = getRegionBlend(
          worldXZ,
          this.uPreviousLocalMin,
          this.uLocalSize,
          this.uLocalBlendDistance,
        );
        const sharedBlend = previousBlend.min(currentBlend);
        localBlend.assign(
          mix(sharedBlend, currentBlend, this.uLocalTransition),
        );
      });
      const localRingUv = worldXZ.div(this.uLocalSize).fract();
      const localFactor = texture(this.localTexture, localRingUv).r;
      return mix(globalFactor, localFactor, localBlend.mul(this.uHasLocal));
    },
  );

  setBias(value: number) {
    this.uBias.value = value;
  }

  setLocalRegion(centerX: number, centerZ: number) {
    const halfSize = shadowSettings.localSize * 0.5;
    this.uLocalBakeMin.value.set(centerX - halfSize, centerZ - halfSize);
    this.uLocalBakeSize.value = shadowSettings.localSize;
    this.canTransitionLocal =
      this.isLocalValid &&
      this.uLocalSize.value === this.uLocalBakeSize.value;
    this.localBakeRects = this.getLocalBakeRects();
    this.uLocalBlendDistance.value = shadowSettings.localBlendDistance;
  }

  markLocalAvailable() {
    if (this.canTransitionLocal) {
      this.uPreviousLocalMin.value.copy(this.uLocalMin.value);
      this.uLocalTransition.value = 0;
    } else {
      this.uPreviousLocalMin.value.copy(this.uLocalBakeMin.value);
      this.uLocalTransition.value = 1;
    }
    this.uLocalMin.value.copy(this.uLocalBakeMin.value);
    this.uLocalSize.value = this.uLocalBakeSize.value;
    this.uHasLocal.value = 1;
    this.isLocalValid = true;
    this.advanceGeneration();
  }

  markGlobalAvailable() {
    this.advanceGeneration();
  }

  invalidateLocal() {
    this.uHasLocal.value = 0;
    this.isLocalValid = false;
    this.uLocalTransition.value = 1;
  }

  update(delta: number) {
    if (this.uLocalTransition.value === 1) return;
    const duration = shadowSettings.localTransitionDuration;
    if (duration === 0) {
      this.uLocalTransition.value = 1;
      return;
    }
    this.uLocalTransition.value = Math.min(
      1,
      this.uLocalTransition.value + delta / duration,
    );
  }

  resetComputes() {
    this.globalBakeCompute = undefined;
    this.localBakeCompute = undefined;
  }

  bakeGlobal() {
    const compute = this.getBakeCompute(false);
    if (!compute) return false;
    this.renderer.compute(compute);
    return true;
  }

  bakeLocal() {
    const compute = this.getBakeCompute(true);
    if (!compute) return false;
    this.bakeLocalRects(compute);
    return true;
  }

  bakeGlobalAsync() {
    const compute = this.getBakeCompute(false);
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

  private getBakeCompute(isLocal: boolean) {
    const cachedCompute = isLocal
      ? this.localBakeCompute
      : this.globalBakeCompute;
    if (cachedCompute) return cachedCompute;
    const depthTexture = this.getShadowDepthTexture();
    if (!depthTexture) return;

    const shadowMatrix = uniform(this.lightingManager.sunLight.shadow.matrix);
    const output = storageTexture(
      isLocal ? this.localTexture : this.globalTexture,
    );
    const textureSize = isLocal
      ? LOCAL_GROUND_TEXTURE_SIZE
      : GLOBAL_GROUND_TEXTURE_SIZE;
    const texel = 1 / shadowSettings.resolution;
    const isReversedDepth = this.renderer.reversedDepthBuffer;

    const compute = Fn(() => {
      const rowWidth = isLocal
        ? uint(this.uLocalBakeRectWidth)
        : uint(textureSize);
      const x = instanceIndex.mod(rowWidth);
      const y = instanceIndex.div(rowWidth);
      const mapUv = vec2(x, y).add(0.5).div(textureSize);
      const localTexelSize = this.uLocalBakeSize.div(
        LOCAL_GROUND_TEXTURE_SIZE,
      );
      const worldXZ = isLocal
        ? vec2(x, y)
            .add(0.5)
            .mul(localTexelSize)
            .add(this.uLocalBakeRectMin)
        : mapUv.mul(realmConfig.MAP_SIZE).sub(realmConfig.HALF_MAP_SIZE);
      const localCell = floor(worldXZ.div(localTexelSize)).mod(
        LOCAL_GROUND_TEXTURE_SIZE,
      );
      const outputCoord = isLocal ? uvec2(localCell) : uvec2(x, y);
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
    compute.name = isLocal
      ? "Local ground shadow bake"
      : "Ground shadow bake";
    if (isLocal) this.localBakeCompute = compute;
    else this.globalBakeCompute = compute;
    return compute;
  }

  private getShadowDepthTexture(): DepthTexture | undefined {
    return this.lightingManager.sunLight.shadow.map?.depthTexture ?? undefined;
  }

  private bakeLocalRects(compute: ComputeNode) {
    const texelSize = this.uLocalBakeSize.value / LOCAL_GROUND_TEXTURE_SIZE;
    for (const rect of this.localBakeRects) {
      const width = Math.round(rect.width / texelSize);
      const height = Math.round(rect.height / texelSize);
      const count = width * height;
      if (count === 0) continue;
      this.uLocalBakeRectMin.value.set(rect.minX, rect.minZ);
      this.uLocalBakeRectWidth.value = width;
      compute.count = count;
      this.renderer.compute(compute, count);
    }
  }

  private getLocalBakeRects(): LocalBakeRect[] {
    const minX = this.uLocalBakeMin.value.x;
    const minZ = this.uLocalBakeMin.value.y;
    const size = this.uLocalBakeSize.value;
    const fullRect = { minX, minZ, width: size, height: size };
    if (!this.isLocalValid || this.uLocalSize.value !== size) return [fullRect];

    const oldMinX = this.uLocalMin.value.x;
    const oldMinZ = this.uLocalMin.value.y;
    const overlapMinX = Math.max(minX, oldMinX);
    const overlapMinZ = Math.max(minZ, oldMinZ);
    const overlapMaxX = Math.min(minX + size, oldMinX + size);
    const overlapMaxZ = Math.min(minZ + size, oldMinZ + size);
    if (overlapMinX >= overlapMaxX || overlapMinZ >= overlapMaxZ) {
      return [fullRect];
    }

    const rects: LocalBakeRect[] = [];
    if (minX < overlapMinX) {
      rects.push({
        minX,
        minZ,
        width: overlapMinX - minX,
        height: size,
      });
    }
    if (overlapMaxX < minX + size) {
      rects.push({
        minX: overlapMaxX,
        minZ,
        width: minX + size - overlapMaxX,
        height: size,
      });
    }

    const overlapWidth = overlapMaxX - overlapMinX;
    if (minZ < overlapMinZ) {
      rects.push({
        minX: overlapMinX,
        minZ,
        width: overlapWidth,
        height: overlapMinZ - minZ,
      });
    }
    if (overlapMaxZ < minZ + size) {
      rects.push({
        minX: overlapMinX,
        minZ: overlapMaxZ,
        width: overlapWidth,
        height: minZ + size - overlapMaxZ,
      });
    }
    return rects;
  }
}
