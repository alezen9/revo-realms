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
const GROUND_TEXTURE_SIZE = 1024;
const SHADOW_PADDING = 12;

const config = {
  resolution: 2048,
  softness: 1,
  blurSamples: 6,
  bias: -0.0001,
  normalBias: 0.04,
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
  readonly uStrength = uniform(0.6);
  readonly uTint = uniform(new Color(0.46, 0.52, 0.64).convertSRGBToLinear());
  private uBias = uniform(config.bias);

  private assetManager: AssetManager;
  private casters = new Map<Object3D, Matrix4>();
  private renderer: WebGPURenderer;
  private lightingManager: LightingManager;
  private groundBakeCompute?: ComputeNode;
  private hasDirtyShadowMap = true;
  private hasPendingGroundBake = true;
  private bounds = new Box3();
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
    this.configureTexture();
    this.configureLight();
    this.debug(debugManager);
    eventsManager.on("engine-sun-change", this.invalidate);
  }

  getMultiplier = Fn<[factor: Node<"float">], Node<"vec3">>(([factor]) => {
    const amount = float(1).sub(factor).mul(this.uStrength);
    return mix(vec3(1), this.uTint, amount);
  });

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
    this.fitShadowCamera();
    this.updateCasterMatrices();
    this.invalidate();
  }

  beforeRender() {
    if (this.haveCastersMoved()) this.invalidate();
    if (!this.hasDirtyShadowMap) return;
    this.fitShadowCamera();
    this.lightingManager.sunLight.shadow.needsUpdate = true;
    this.hasDirtyShadowMap = false;
    this.hasPendingGroundBake = true;
  }

  afterRender() {
    if (!this.hasPendingGroundBake) return;
    const compute = this.getGroundBakeCompute();
    if (!compute) return;
    this.renderer.compute(compute);
    this.hasPendingGroundBake = false;
  }

  bakeGroundAsync() {
    this.fitShadowCamera();
    this.updateCasterMatrices();
    this.hasDirtyShadowMap = false;
    const compute = this.getGroundBakeCompute();
    if (!compute) return Promise.resolve(false);
    this.hasPendingGroundBake = false;
    return this.renderer.computeAsync(compute).then(() => true);
  }

  invalidate = () => {
    this.hasDirtyShadowMap = true;
  };

  private configureTexture() {
    this.groundTexture.name = "shadows.ground";
    this.groundTexture.colorSpace = NoColorSpace;
    this.groundTexture.format = RedFormat;
    this.groundTexture.type = UnsignedByteType;
    this.groundTexture.generateMipmaps = false;
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

  private fitShadowCamera() {
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

    this.bounds.getCenter(this.boundsCenter);
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
    let near = Infinity;
    let far = -Infinity;

    for (let index = 0; index < 8; index++) {
      this.viewCorner
        .set(
          index & 1 ? this.bounds.max.x : this.bounds.min.x,
          index & 2 ? this.bounds.max.y : this.bounds.min.y,
          index & 4 ? this.bounds.max.z : this.bounds.min.z,
        )
        .applyMatrix4(camera.matrixWorldInverse);
      left = Math.min(left, this.viewCorner.x);
      right = Math.max(right, this.viewCorner.x);
      bottom = Math.min(bottom, this.viewCorner.y);
      top = Math.max(top, this.viewCorner.y);
      const depth = -this.viewCorner.z;
      near = Math.min(near, depth);
      far = Math.max(far, depth);
    }

    camera.left = left - SHADOW_PADDING;
    camera.right = right + SHADOW_PADDING;
    camera.bottom = bottom - SHADOW_PADDING;
    camera.top = top + SHADOW_PADDING;
    camera.near = Math.max(0.1, near - SHADOW_PADDING);
    camera.far = far + SHADOW_PADDING;
    camera.updateProjectionMatrix();
  }

  private getGroundBakeCompute() {
    if (this.groundBakeCompute) return this.groundBakeCompute;
    const depthTexture = this.getShadowDepthTexture();
    if (!depthTexture) return;

    const shadowMatrix = uniform(this.lightingManager.sunLight.shadow.matrix);
    const output = storageTexture(this.groundTexture);
    const texel = 1 / config.resolution;
    const isReversedDepth = this.renderer.reversedDepthBuffer;

    this.groundBakeCompute = Fn(() => {
      const x = instanceIndex.mod(GROUND_TEXTURE_SIZE);
      const y = instanceIndex.div(GROUND_TEXTURE_SIZE);
      const outputCoord = uvec2(x, y);
      const mapUv = vec2(x, y).add(0.5).div(GROUND_TEXTURE_SIZE);
      const heightUv = vec2(mapUv.x, float(1).sub(mapUv.y));
      const height = texture(this.assetManager.resources.heightmap, heightUv).r;
      const worldXZ = mapUv
        .mul(realmConfig.MAP_SIZE)
        .sub(realmConfig.HALF_MAP_SIZE);
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
    this.groundBakeCompute.name = "Ground shadow bake";
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
      .addBinding(config, "refresh", { label: "Refresh now" })
      .on("change", this.invalidate);
  }
}
