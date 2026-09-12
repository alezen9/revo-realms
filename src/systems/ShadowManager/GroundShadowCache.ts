import {
  type DepthTexture,
  NoColorSpace,
  RedFormat,
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
  Fn,
  instanceIndex,
  mix,
  smoothstep,
  step,
  storageTexture,
  texture,
  textureStore,
  uniform,
  uvec2,
  vec2,
  vec4,
} from "three/tsl";
import { realmConfig } from "../../realm/config";
import type { AssetManager } from "../AssetManager/AssetManager";
import type { LightingManager } from "../LightingManager";
import { GROUND_TEXTURE_SIZE, shadowSettings } from "./ShadowSettings";

const getDepthVisibility = (
  sampleDepth: Node<"float">,
  receiverDepth: Node<"float">,
  isReversedDepth: boolean,
) =>
  isReversedDepth
    ? step(sampleDepth, receiverDepth)
    : step(receiverDepth, sampleDepth);

export class GroundShadowCache {
  readonly uGeneration = uniform(0);
  readonly globalTexture = new StorageTexture(
    GROUND_TEXTURE_SIZE,
    GROUND_TEXTURE_SIZE,
  );
  readonly localTexture = new StorageTexture(
    GROUND_TEXTURE_SIZE,
    GROUND_TEXTURE_SIZE,
  );
  private uBias = uniform(shadowSettings.bias);
  private uHasLocal = uniform(0);
  private uLocalMin = uniform(new Vector2());
  private uLocalSize = uniform(shadowSettings.localSize);
  private uLocalBlend = uniform(
    shadowSettings.localBlendDistance / shadowSettings.localSize,
  );
  private assetManager: AssetManager;
  private lightingManager: LightingManager;
  private renderer: WebGPURenderer;
  private globalBakeCompute?: ComputeNode;
  private localBakeCompute?: ComputeNode;

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
  }

  getGroundFactor = Fn<[worldXZ: Node<"vec2">], Node<"float">>(
    ([worldXZ]) => {
      const globalUv = worldXZ
        .add(realmConfig.HALF_MAP_SIZE)
        .div(realmConfig.MAP_SIZE);
      const globalFactor = texture(this.globalTexture, globalUv).r;
      const localUv = worldXZ.sub(this.uLocalMin).div(this.uLocalSize);
      const one = float(1);
      const isInside = step(0, localUv.x)
        .mul(step(localUv.x, 1))
        .mul(step(0, localUv.y))
        .mul(step(localUv.y, 1));
      const edgeDistance = localUv.x
        .min(one.sub(localUv.x))
        .min(localUv.y)
        .min(one.sub(localUv.y));
      const localBlend = smoothstep(0, this.uLocalBlend, edgeDistance)
        .mul(isInside)
        .mul(this.uHasLocal);
      const localFactor = texture(this.localTexture, localUv).r;
      return mix(globalFactor, localFactor, localBlend);
    },
  );

  setBias(value: number) {
    this.uBias.value = value;
  }

  setLocalRegion(centerX: number, centerZ: number) {
    const halfSize = shadowSettings.localSize * 0.5;
    this.uLocalMin.value.set(centerX - halfSize, centerZ - halfSize);
    this.uLocalSize.value = shadowSettings.localSize;
    this.uLocalBlend.value =
      shadowSettings.localBlendDistance / shadowSettings.localSize;
    this.uHasLocal.value = 0;
  }

  markLocalAvailable() {
    this.uHasLocal.value = 1;
    this.advanceGeneration();
  }

  markGlobalAvailable() {
    this.advanceGeneration();
  }

  invalidateLocal() {
    this.uHasLocal.value = 0;
  }

  resetComputes() {
    this.globalBakeCompute = undefined;
    this.localBakeCompute = undefined;
  }

  bake(isLocal: boolean) {
    const compute = this.getBakeCompute(isLocal);
    if (!compute) return false;
    this.renderer.compute(compute);
    return true;
  }

  bakeAsync(isLocal: boolean) {
    const compute = this.getBakeCompute(isLocal);
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
    const texel = 1 / shadowSettings.resolution;
    const isReversedDepth = this.renderer.reversedDepthBuffer;

    const compute = Fn(() => {
      const x = instanceIndex.mod(GROUND_TEXTURE_SIZE);
      const y = instanceIndex.div(GROUND_TEXTURE_SIZE);
      const outputCoord = uvec2(x, y);
      const mapUv = vec2(x, y).add(0.5).div(GROUND_TEXTURE_SIZE);
      const worldXZ = isLocal
        ? mapUv.mul(this.uLocalSize).add(this.uLocalMin)
        : mapUv.mul(realmConfig.MAP_SIZE).sub(realmConfig.HALF_MAP_SIZE);
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
    })().compute(GROUND_TEXTURE_SIZE * GROUND_TEXTURE_SIZE, [8, 8, 1]);
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
}
