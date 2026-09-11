import {
  Box3,
  Color,
  type DepthTexture,
  type Material,
  Matrix4,
  type Mesh,
  NoColorSpace,
  type Object3D,
  RedFormat,
  UnsignedByteType,
  Vector2,
  Vector3,
} from "three";
import {
  type ComputeNode,
  type Node,
  NodeMaterial,
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
  vec3,
  vec4,
} from "three/tsl";
import { realmConfig } from "../realm/config";
import { srgbColorTarget } from "../utils/TweakpaneColor";
import type { AssetManager } from "./AssetManager/AssetManager";
import type { DebugManager } from "./DebugManager";
import type { EventsManager } from "./EventsManager";
import type { LightingManager } from "./LightingManager";

type Registration = {
  cast?: boolean;
  receive?: boolean;
};

const STATIC_SHADOW_LAYER = 1;
const GROUND_TEXTURE_SIZE = 2048;
const SHADOW_PADDING = 12;

const config = {
  resolution: 2048,
  softness: 1,
  blurSamples: 6,
  bias: -0.0001,
  normalBias: 0.04,
  localSize: 64,
  localCellSize: 8,
  refresh: false,
};

const isMesh = (object: Object3D): object is Mesh =>
  "isMesh" in object && object.isMesh === true;

const isNodeMaterial = (material: Material): material is NodeMaterial =>
  "isNodeMaterial" in material && material.isNodeMaterial === true;

const getDepthVisibility = (
  sampleDepth: Node<"float">,
  receiverDepth: Node<"float">,
  isReversedDepth: boolean,
) =>
  isReversedDepth
    ? step(sampleDepth, receiverDepth)
    : step(receiverDepth, sampleDepth);

export class ShadowManager {
  readonly groundTexture = new StorageTexture(
    GROUND_TEXTURE_SIZE,
    GROUND_TEXTURE_SIZE,
  );
  readonly localGroundTexture = new StorageTexture(
    GROUND_TEXTURE_SIZE,
    GROUND_TEXTURE_SIZE,
  );
  readonly uStrength = uniform(0.6);
  readonly uTint = uniform(new Color(0.46, 0.52, 0.64).convertSRGBToLinear());
  private uBias = uniform(config.bias);
  private uHasLocalGround = uniform(0);
  private uLocalGroundMin = uniform(new Vector2());
  private uLocalGroundSize = uniform(config.localSize);
  private uLocalGroundBlend = uniform(4 / config.localSize);

  private assetManager: AssetManager;
  private casters = new Map<Object3D, Matrix4>();
  private renderer: WebGPURenderer;
  private lightingManager: LightingManager;
  private groundBakeCompute?: ComputeNode;
  private localGroundBakeCompute?: ComputeNode;
  private hasDirtyGlobalShadowMap = true;
  private hasDirtyLocalShadowMap = true;
  private hasPendingGroundBake = true;
  private hasPendingLocalGroundBake = true;
  private isGlobalProjection = true;
  private localCenterX = Number.NaN;
  private localCenterZ = Number.NaN;
  private bounds = new Box3();
  private localBounds = new Box3();
  private boundsSize = new Vector3();
  private boundsCenter = new Vector3();
  private viewCorner = new Vector3();

  constructor(
    renderer: WebGPURenderer,
    lightingManager: LightingManager,
    assetManager: AssetManager,
    eventsManager: EventsManager,
    debugManager: DebugManager,
  ) {
    this.renderer = renderer;
    this.lightingManager = lightingManager;
    this.assetManager = assetManager;
    this.configureTexture(this.groundTexture, "shadows.ground");
    this.configureTexture(this.localGroundTexture, "shadows.ground.local");
    this.configureLight();
    this.debug(debugManager);
    eventsManager.on("engine-sun-change", this.invalidate);
  }

  getMultiplier = Fn<[factor: Node<"float">], Node<"vec3">>(([factor]) => {
    const amount = float(1).sub(factor).mul(this.uStrength);
    return mix(vec3(1), this.uTint, amount);
  });

  getGroundFactor = Fn<[worldXZ: Node<"vec2">], Node<"float">>(
    ([worldXZ]) => {
      const globalUv = worldXZ
        .add(realmConfig.HALF_MAP_SIZE)
        .div(realmConfig.MAP_SIZE);
      const globalFactor = texture(this.groundTexture, globalUv).r;
      const localUv = worldXZ
        .sub(this.uLocalGroundMin)
        .div(this.uLocalGroundSize);
      const one = float(1);
      const isInside = step(0, localUv.x)
        .mul(step(localUv.x, 1))
        .mul(step(0, localUv.y))
        .mul(step(localUv.y, 1));
      const edgeDistance = localUv.x
        .min(one.sub(localUv.x))
        .min(localUv.y)
        .min(one.sub(localUv.y));
      const localBlend = smoothstep(0, this.uLocalGroundBlend, edgeDistance)
        .mul(isInside)
        .mul(this.uHasLocalGround);
      const localFactor = texture(this.localGroundTexture, localUv).r;
      return mix(globalFactor, localFactor, localBlend);
    },
  );

  register(object: Object3D, registration: Registration) {
    const { cast = false, receive = false } = registration;
    object.updateWorldMatrix(true, true);

    object.traverse((child) => {
      if (!isMesh(child)) return;

      if (cast) {
        child.castShadow = true;
        child.layers.enable(STATIC_SHADOW_LAYER);
        this.casters.set(child, child.matrixWorld.clone());
      }

      if (!receive) return;
      child.receiveShadow = true;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) this.configureReceiver(material);
    });

    if (cast) this.invalidate();
  }

  prepareBake() {
    this.fitGlobalShadowCamera();
    this.updateCasterMatrices();
    this.lightingManager.sunLight.shadow.needsUpdate = true;
    this.hasDirtyGlobalShadowMap = false;
    this.hasDirtyLocalShadowMap = true;
    this.hasPendingGroundBake = true;
    this.hasPendingLocalGroundBake = true;
    this.isGlobalProjection = true;
  }

  beforeRender(playerPosition: Vector3) {
    this.updateLocalCenter(playerPosition);
    if (this.haveCastersMoved()) this.invalidate();

    if (this.hasDirtyGlobalShadowMap) {
      this.fitGlobalShadowCamera();
      this.lightingManager.sunLight.shadow.needsUpdate = true;
      this.hasDirtyGlobalShadowMap = false;
      this.hasPendingGroundBake = true;
      this.isGlobalProjection = true;
      return;
    }

    if (!this.hasDirtyLocalShadowMap) return;
    this.fitLocalShadowCamera();
    this.lightingManager.sunLight.shadow.needsUpdate = true;
    this.hasDirtyLocalShadowMap = false;
    this.hasPendingLocalGroundBake = true;
    this.uHasLocalGround.value = 0;
    this.isGlobalProjection = false;
  }

  afterRender() {
    if (this.isGlobalProjection) {
      if (!this.hasPendingGroundBake) return;
      const compute = this.getGroundBakeCompute(false);
      if (!compute) return;
      this.renderer.compute(compute);
      this.hasPendingGroundBake = false;
      return;
    }

    if (!this.hasPendingLocalGroundBake) return;
    const compute = this.getGroundBakeCompute(true);
    if (!compute) return;
    this.renderer.compute(compute);
    this.hasPendingLocalGroundBake = false;
    this.uHasLocalGround.value = 1;
  }

  bakeGroundAsync() {
    if (!this.isGlobalProjection) {
      this.invalidate();
      return Promise.resolve(false);
    }
    this.updateCasterMatrices();
    const compute = this.getGroundBakeCompute(false);
    if (!compute) {
      this.invalidate();
      return Promise.resolve(false);
    }
    this.hasPendingGroundBake = false;
    this.hasDirtyLocalShadowMap = true;
    return this.renderer.computeAsync(compute).then(() => true);
  }

  invalidate = () => {
    this.hasDirtyGlobalShadowMap = true;
    this.hasDirtyLocalShadowMap = true;
  };

  private configureTexture(textureValue: StorageTexture, name: string) {
    textureValue.name = name;
    textureValue.colorSpace = NoColorSpace;
    textureValue.format = RedFormat;
    textureValue.type = UnsignedByteType;
    textureValue.generateMipmaps = false;
  }

  private configureLight() {
    const { sunLight } = this.lightingManager;
    const { shadow } = sunLight;
    sunLight.castShadow = true;
    shadow.mapSize.setScalar(config.resolution);
    shadow.bias = config.bias;
    shadow.normalBias = config.normalBias;
    shadow.radius = config.softness;
    shadow.blurSamples = config.blurSamples;
    shadow.intensity = 1;
    shadow.autoUpdate = false;
    shadow.needsUpdate = true;
    shadow.camera.layers.set(STATIC_SHADOW_LAYER);
  }

  private configureReceiver(material: Material) {
    if (!isNodeMaterial(material)) return;
    if (material.receivedShadowNode) return;
    material.receivedShadowNode = this.applyReceiverShadow;
    material.needsUpdate = true;
  }

  private haveCastersMoved() {
    let hasMoved = false;
    for (const [object, previousMatrix] of this.casters) {
      object.updateWorldMatrix(true, false);
      if (previousMatrix.equals(object.matrixWorld)) continue;
      previousMatrix.copy(object.matrixWorld);
      hasMoved = true;
    }
    return hasMoved;
  }

  private updateCasterMatrices() {
    for (const [object, previousMatrix] of this.casters) {
      object.updateWorldMatrix(true, false);
      previousMatrix.copy(object.matrixWorld);
    }
  }

  private updateBounds() {
    const minHeight = this.assetManager.resources.heightmap.userData.min ?? -32;
    const maxHeight = this.assetManager.resources.heightmap.userData.max ?? 64;
    this.bounds.min.set(
      -realmConfig.HALF_MAP_SIZE,
      minHeight,
      -realmConfig.HALF_MAP_SIZE,
    );
    this.bounds.max.set(
      realmConfig.HALF_MAP_SIZE,
      maxHeight,
      realmConfig.HALF_MAP_SIZE,
    );
    for (const caster of this.casters.keys())
      this.bounds.expandByObject(caster, true);
  }

  private fitGlobalShadowCamera() {
    this.updateBounds();
    this.bounds.getCenter(this.boundsCenter);
    this.fitShadowCamera(this.bounds, this.bounds, SHADOW_PADDING, false);
  }

  private updateLocalCenter(playerPosition: Vector3) {
    const isInsideCurrentCell =
      Number.isFinite(this.localCenterX) &&
      Math.abs(playerPosition.x - this.localCenterX) <= config.localCellSize &&
      Math.abs(playerPosition.z - this.localCenterZ) <= config.localCellSize;
    if (isInsideCurrentCell) return;
    this.localCenterX =
      Math.round(playerPosition.x / config.localCellSize) *
      config.localCellSize;
    this.localCenterZ =
      Math.round(playerPosition.z / config.localCellSize) *
      config.localCellSize;
    this.hasDirtyLocalShadowMap = true;
  }

  private fitLocalShadowCamera() {
    this.updateBounds();
    const halfSize = config.localSize * 0.5;
    this.uLocalGroundMin.value.set(
      this.localCenterX - halfSize,
      this.localCenterZ - halfSize,
    );
    this.localBounds.min.set(
      this.localCenterX - halfSize,
      this.bounds.min.y,
      this.localCenterZ - halfSize,
    );
    this.localBounds.max.set(
      this.localCenterX + halfSize,
      this.bounds.max.y,
      this.localCenterZ + halfSize,
    );
    this.localBounds.getCenter(this.boundsCenter);
    this.fitShadowCamera(this.localBounds, this.bounds, 0, true);
  }

  private fitShadowCamera(
    projectionBounds: Box3,
    depthBounds: Box3,
    projectionPadding: number,
    isStabilized: boolean,
  ) {
    this.bounds.getSize(this.boundsSize);
    const lightDistance = this.boundsSize.length() + SHADOW_PADDING * 2;
    const { sunLight } = this.lightingManager;
    sunLight.target.position.copy(this.boundsCenter);
    sunLight.target.updateMatrixWorld();
    sunLight.position
      .copy(this.lightingManager.sunDirection)
      .multiplyScalar(-lightDistance)
      .add(this.boundsCenter);
    sunLight.updateMatrixWorld();

    const camera = sunLight.shadow.camera;
    camera.position.copy(sunLight.position);
    camera.lookAt(this.boundsCenter);
    camera.updateMatrixWorld();

    let left = Infinity;
    let right = -Infinity;
    let bottom = Infinity;
    let top = -Infinity;
    for (let index = 0; index < 8; index++) {
      this.viewCorner
        .set(
          index & 1 ? projectionBounds.max.x : projectionBounds.min.x,
          index & 2 ? projectionBounds.max.y : projectionBounds.min.y,
          index & 4 ? projectionBounds.max.z : projectionBounds.min.z,
        )
        .applyMatrix4(camera.matrixWorldInverse);
      left = Math.min(left, this.viewCorner.x);
      right = Math.max(right, this.viewCorner.x);
      bottom = Math.min(bottom, this.viewCorner.y);
      top = Math.max(top, this.viewCorner.y);
    }

    let near = Infinity;
    let far = -Infinity;
    for (let index = 0; index < 8; index++) {
      this.viewCorner
        .set(
          index & 1 ? depthBounds.max.x : depthBounds.min.x,
          index & 2 ? depthBounds.max.y : depthBounds.min.y,
          index & 4 ? depthBounds.max.z : depthBounds.min.z,
        )
        .applyMatrix4(camera.matrixWorldInverse);
      const depth = -this.viewCorner.z;
      near = Math.min(near, depth);
      far = Math.max(far, depth);
    }

    const centerLightX = (left + right) * 0.5;
    const centerLightY = (bottom + top) * 0.5;
    const halfWidth = (right - left) * 0.5;
    const halfHeight = (top - bottom) * 0.5;
    let stableCenterX = centerLightX;
    let stableCenterY = centerLightY;
    if (isStabilized) {
      const texelX = (halfWidth * 2) / config.resolution;
      const texelY = (halfHeight * 2) / config.resolution;
      stableCenterX = Math.round(centerLightX / texelX) * texelX;
      stableCenterY = Math.round(centerLightY / texelY) * texelY;
    }
    camera.left = stableCenterX - halfWidth - projectionPadding;
    camera.right = stableCenterX + halfWidth + projectionPadding;
    camera.bottom = stableCenterY - halfHeight - projectionPadding;
    camera.top = stableCenterY + halfHeight + projectionPadding;
    camera.near = Math.max(0.1, near - SHADOW_PADDING);
    camera.far = far + SHADOW_PADDING;
    camera.updateProjectionMatrix();
  }

  private getGroundBakeCompute(isLocal: boolean) {
    const cachedCompute = isLocal
      ? this.localGroundBakeCompute
      : this.groundBakeCompute;
    if (cachedCompute) return cachedCompute;
    const depthTexture = this.getShadowDepthTexture();
    if (!depthTexture) return;

    const shadowMatrix = uniform(this.lightingManager.sunLight.shadow.matrix);
    const output = storageTexture(
      isLocal ? this.localGroundTexture : this.groundTexture,
    );
    const texel = 1 / config.resolution;
    const isReversedDepth = this.renderer.reversedDepthBuffer;

    const compute = Fn(() => {
      const x = instanceIndex.mod(GROUND_TEXTURE_SIZE);
      const y = instanceIndex.div(GROUND_TEXTURE_SIZE);
      const outputCoord = uvec2(x, y);
      const mapUv = vec2(x, y).add(0.5).div(GROUND_TEXTURE_SIZE);
      const worldXZ = isLocal
        ? mapUv.mul(this.uLocalGroundSize).add(this.uLocalGroundMin)
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
    const label = isLocal ? "Local ground shadow bake" : "Ground shadow bake";
    if (isLocal) {
      this.localGroundBakeCompute = compute;
      this.localGroundBakeCompute.name = label;
      return this.localGroundBakeCompute;
    }
    this.groundBakeCompute = compute;
    this.groundBakeCompute.name = label;
    return this.groundBakeCompute;
  }

  private getShadowDepthTexture(): DepthTexture | undefined {
    return this.lightingManager.sunLight.shadow.map?.depthTexture ?? undefined;
  }

  private applyReceiverShadow = (factor?: Node<"float">) => {
    if (!factor) return vec3(1);
    return this.getMultiplier(factor);
  };

  private debug(debugManager: DebugManager) {
    const folder = debugManager.panel.addFolder({
      title: "🌘 Shadows",
      expanded: false,
    });
    folder.addBinding(this.uStrength, "value", {
      label: "Strength",
      min: 0,
      max: 1,
      step: 0.01,
    });
    folder.addBinding(srgbColorTarget(this.uTint.value), "value", {
      label: "Tint",
      view: "color",
      color: { type: "float" },
    });
    folder
      .addBinding(config, "resolution", {
        label: "Resolution",
        options: { "1024": 1024, "2048": 2048, "4096": 4096 },
      })
      .on("change", ({ value }) => {
        this.lightingManager.sunLight.shadow.mapSize.setScalar(value);
        this.groundBakeCompute = undefined;
        this.localGroundBakeCompute = undefined;
        this.invalidate();
      });
    folder
      .addBinding(config, "softness", {
        label: "Softness",
        min: 0,
        max: 5,
        step: 0.1,
      })
      .on("change", ({ value }) => {
        this.lightingManager.sunLight.shadow.radius = value;
        this.invalidate();
      });
    folder
      .addBinding(config, "bias", {
        label: "Depth bias",
        min: -0.002,
        max: 0.002,
        step: 0.00001,
      })
      .on("change", ({ value }) => {
        this.lightingManager.sunLight.shadow.bias = value;
        this.uBias.value = value;
        this.invalidate();
      });
    folder
      .addBinding(config, "normalBias", {
        label: "Normal bias",
        min: 0,
        max: 0.25,
        step: 0.005,
      })
      .on("change", ({ value }) => {
        this.lightingManager.sunLight.shadow.normalBias = value;
        this.invalidate();
      });
    folder
      .addBinding(config, "localSize", {
        label: "Local size",
        min: 32,
        max: 128,
        step: 8,
      })
      .on("change", () => {
        this.uLocalGroundSize.value = config.localSize;
        this.uLocalGroundBlend.value = 4 / config.localSize;
        this.hasDirtyLocalShadowMap = true;
      });
    folder
      .addBinding(config, "localCellSize", {
        label: "Recenter distance",
        min: 2,
        max: 16,
        step: 2,
      })
      .on("change", () => {
        this.localCenterX = Number.NaN;
        this.localCenterZ = Number.NaN;
      });
    folder
      .addBinding(config, "refresh", { label: "Refresh now" })
      .on("change", this.invalidate);
  }
}
