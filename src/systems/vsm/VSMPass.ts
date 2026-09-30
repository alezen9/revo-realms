import { NoToneMapping, type Camera, type Mesh } from "three";
import type {
  ComputeNode,
  Node,
  TextureNode,
  WebGPURenderer,
} from "three/webgpu";
import {
  float,
  mix,
  renderOutput,
  screenUV,
  step,
  uint,
  uniform,
  uvec2,
  vec3,
  vec4,
} from "three/tsl";
import type { DebugFolder } from "../debug/DebugPanel";
import type { ScenePass } from "../rendering/passes/ScenePass";
import type { Assets } from "../assets/Assets";
import type { Lighting } from "../lighting/Lighting";
import type { PerformanceMonitor } from "../monitoring/PerformanceMonitor";
import {
  VSM_POOL_CAPACITY,
  VSMContext,
  type VSMCasterOptions,
} from "./VSMContext";
import { VSMDepthPool } from "./VSMDepthPool";
import { VSMDynamicLayer } from "./VSMDynamicLayer";
import {
  VSM_PAGE_TEXELS,
  getLightPosition,
  getPageCoordinate,
  getPageKey,
  getPageSize,
  getPageTag,
  VSM_SOFT_RECEIVER_THRESHOLD,
  getReceiverLevel,
  getSoftReceiverLevel,
  vsmResolutionBias,
  vsmSoftReceiverLevelBias,
} from "./VSMMath";
import { VSMPages } from "./VSMPages";
import { VSMSampler } from "./VSMSampler";

const SKY_COLOR = vec3(0);
const MISSING_PAGE_COLOR = vec3(1, 0, 0);
const MISSING_HEAT_COLOR = vec3(1, 0, 1);
const PAGE_EDGE_COLOR = vec3(1);
const LEVEL_HUE_STEPS = vec3(0.37, 0.61, 0.83);
const HEAT_NEW_COLOR = vec3(1, 0.1, 0.05);
const HEAT_HOT_COLOR = vec3(1, 0.5, 0.05);
const HEAT_WARM_COLOR = vec3(0.95, 0.85, 0.1);
const HEAT_COOL_COLOR = vec3(0.2, 0.6, 0.3);
const HEAT_COLD_COLOR = vec3(0.12, 0.16, 0.3);

export type VSMDependencies = {
  lighting: Lighting;
  assets: Assets;
  performanceMonitor: PerformanceMonitor;
};

export class VSMPass {
  private renderer: WebGPURenderer;
  private scene: ScenePass;
  private camera: Camera;
  private lighting: Lighting;
  private assets: Assets;
  private context: VSMContext;
  private pages: VSMPages;
  private staticCache: VSMDepthPool;
  private dynamicLayer: VSMDynamicLayer;
  private sampler: VSMSampler;
  private uSunVisibility = uniform(1);
  private uShadowIntensity = uniform(0.8);
  private terrainBounds = { min: 0, max: 0 };
  private computeNodes: ComputeNode[] = [];

  constructor(
    renderer: WebGPURenderer,
    scene: ScenePass,
    camera: Camera,
    dependencies: VSMDependencies,
  ) {
    const { lighting, assets, performanceMonitor } = dependencies;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.lighting = lighting;
    this.assets = assets;
    this.context = new VSMContext(renderer, lighting.uSunDir);
    this.context.setCamera(camera);
    this.pages = new VSMPages(
      renderer,
      this.context,
      scene.depthTexture,
      scene.softShadow.value,
    );
    this.staticCache = new VSMDepthPool(this.context, {
      kind: "static",
      capacity: VSM_POOL_CAPACITY,
      jobs: this.context.allocatedJobs,
      depthBiasTexels: 3,
    });
    this.dynamicLayer = new VSMDynamicLayer(this.context);
    this.sampler = new VSMSampler(
      this.context,
      scene,
      this.staticCache,
      this.dynamicLayer.pool,
    );
    performanceMonitor.setShadowPageStats(this.pages.stats);
  }

  setCamera(camera: Camera) {
    this.camera = camera;
    this.context.setCamera(camera);
  }

  registerCaster(mesh: Mesh, options?: VSMCasterOptions) {
    this.context.registerCaster(mesh, options);
  }

  unregisterCaster(mesh: Mesh) {
    this.context.unregisterCaster(mesh);
  }

  setCasterDepthBias(mesh: Mesh, depthBias: number) {
    this.context.setCasterDepthBias(mesh, depthBias);
  }

  apply(sceneColor: TextureNode) {
    return this.resolveShadows(sceneColor.sample(screenUV), screenUV);
  }

  render() {
    this.context.beginFrame(this.camera, this.lighting.sunDirection);
    const { min, max } = this.assets.resources.heightmap.userData;
    if (typeof min !== "number" || typeof max !== "number")
      throw new Error("Shadows require terrain height bounds");
    const { terrainBounds, computeNodes } = this;
    terrainBounds.min = min;
    terrainBounds.max = max;
    this.staticCache.sync(terrainBounds);
    this.dynamicLayer.sync(terrainBounds);
    computeNodes.length = 0;
    this.pages.collectRequestNodes(computeNodes);
    const hasResidencyWork = this.pages.collectResidencyNodes(computeNodes);
    if (hasResidencyWork) this.staticCache.collectComputeNodes(computeNodes);
    this.dynamicLayer.collectComputeNodes(computeNodes);
    this.renderer.compute(computeNodes);
  }

  sampleShadowedColor(uv: Node<"vec2">) {
    return this.resolveShadows(this.scene.output.sample(uv), uv);
  }

  addBindings(folder: DebugFolder) {
    folder.addBinding(this.uSunVisibility, "value", {
      label: "Sun visibility",
      min: 0,
      max: 1,
      step: 0.05,
    });
    folder.addBinding(this.uShadowIntensity, "value", {
      label: "Shadow intensity",
      min: 0,
      max: 1,
      step: 0.05,
    });
    folder.addBinding(this.sampler.filter.softness, "value", {
      label: "Shadow softness",
      min: 0,
      max: 3,
      step: 0.05,
    });
    folder.addBinding(this.sampler.filter.lightSize, "value", {
      label: "Shadow light size",
      min: 0,
      max: 0.1,
      step: 0.001,
    });
    folder.addBinding(this.sampler.filter.maxSoftness, "value", {
      label: "Shadow max softness",
      min: 0,
      max: 16,
      step: 0.5,
    });
    folder.addBinding(vsmSoftReceiverLevelBias, "value", {
      label: "Soft receiver blur level",
      min: 0,
      max: 4,
      step: 1,
    });
    folder.addBinding(vsmResolutionBias, "value", {
      label: "Shadow resolution bias",
      min: 0,
      max: 4,
      step: 1,
    });
  }

  createDebugOutputs() {
    return {
      Pages: this.makePageOutput(),
      "Page heat": this.makePageHeatOutput(),
      Shadow: renderOutput(
        vec4(vec3(this.sampler.resolveVisibility(screenUV)), 1),
        NoToneMapping,
      ),
      "Static depth": this.makeDepthOutput(this.staticCache, false),
      "Dynamic depth": this.makeDepthOutput(this.dynamicLayer.pool, true),
    };
  }

  private resolveShadows(sceneColor: Node<"vec4">, uv: Node<"vec2">) {
    const visibility = this.sampler.resolveVisibility(uv);
    const directSun = this.scene.directSun.sample(uv).rgb;
    const shadowVisibility = mix(float(1), visibility, this.uShadowIntensity);
    const sunOcclusion = float(1).sub(
      this.uSunVisibility.mul(shadowVisibility),
    );
    const occludedSun = directSun.mul(sunOcclusion);
    return sceneColor.sub(vec4(occludedSun, 0)).max(0);
  }

  private getDebugPage() {
    const { depth, worldPosition, viewDistance } =
      this.sampler.getReceiver(screenUV);
    const softness = this.sampler.getSoftness(screenUV);
    const isSoftReceiver = softness.greaterThan(VSM_SOFT_RECEIVER_THRESHOLD);
    const softLevel = getSoftReceiverLevel(viewDistance, softness).floor();
    const receiverLevel = float(getReceiverLevel(viewDistance));
    const level = uint(mix(receiverLevel, softLevel, float(isSoftReceiver)));
    const pagePosition = getLightPosition(
      worldPosition,
      this.context.lightBasis,
    ).div(getPageSize(level));
    const pageCoordinate = getPageCoordinate(pagePosition);
    return {
      depth,
      level,
      pagePosition,
      pageKey: getPageKey(level, pageCoordinate),
      pageTag: getPageTag(pageCoordinate),
    };
  }

  private makePageOutput() {
    const { depth, level, pagePosition, pageKey, pageTag } =
      this.getDebugPage();
    const { isResident } = this.context.resolvePage(pageKey, pageTag);
    const pageUv = pagePosition.fract();
    const levelHue = LEVEL_HUE_STEPS.mul(float(level)).fract();
    const pageColor = levelHue.mul(0.6).add(0.3);
    const edgeOffset = pageUv.min(float(1).sub(pageUv));
    const edgeDistance = edgeOffset.x.min(edgeOffset.y);
    const edgeHighlight = step(edgeDistance, 0.025).mul(0.7);
    const outlinedPageColor = mix(pageColor, PAGE_EDGE_COLOR, edgeHighlight);
    const isSky = depth.greaterThanEqual(1);
    const residentColor = mix(
      MISSING_PAGE_COLOR,
      outlinedPageColor,
      float(isResident),
    );
    const color = mix(residentColor, SKY_COLOR, float(isSky));
    return renderOutput(vec4(color, 1), NoToneMapping);
  }

  private makeDepthOutput(layer: VSMDepthPool, isDynamic: boolean) {
    const { depth, pagePosition, pageKey, pageTag } = this.getDebugPage();
    const { slot, dynamicSlot, isResident, hasDynamic } =
      this.context.resolvePage(pageKey, pageTag);
    const pageTexelPosition = pagePosition.fract().mul(VSM_PAGE_TEXELS);
    const texel = uvec2(
      pageTexelPosition.floor().clamp(0, VSM_PAGE_TEXELS - 1),
    );
    let layerSlot = slot;
    let hasPage = isResident;
    if (isDynamic) {
      layerSlot = dynamicSlot;
      hasPage = hasDynamic;
    }
    const layerDepth = layer.loadDepth(layerSlot, texel);
    const visualDepth = layerDepth.sub(0.65).mul(5).clamp();
    const isSky = depth.greaterThanEqual(1);
    const pageColor = mix(
      MISSING_PAGE_COLOR,
      vec3(visualDepth),
      float(hasPage),
    );
    const color = mix(pageColor, SKY_COLOR, float(isSky));
    return renderOutput(vec4(color, 1), NoToneMapping);
  }

  private makePageHeatOutput() {
    const { depth, pageKey, pageTag } = this.getDebugPage();
    const { frame, slotRenderFramesNode } = this.context;
    const { slot, isResident } = this.context.resolvePage(pageKey, pageTag);
    const age = frame.sub(slotRenderFramesNode.element(slot));
    const isNew = age.lessThan(2);
    const isHot = age.lessThan(10);
    const isWarm = age.lessThan(30);
    const isCool = age.lessThan(120);
    const coolColor = mix(HEAT_COLD_COLOR, HEAT_COOL_COLOR, float(isCool));
    const warmColor = mix(coolColor, HEAT_WARM_COLOR, float(isWarm));
    const hotColor = mix(warmColor, HEAT_HOT_COLOR, float(isHot));
    const heatColor = mix(hotColor, HEAT_NEW_COLOR, float(isNew));
    const isSky = depth.greaterThanEqual(1);
    const residentColor = mix(MISSING_HEAT_COLOR, heatColor, float(isResident));
    const color = mix(residentColor, SKY_COLOR, float(isSky));
    return renderOutput(vec4(color, 1), NoToneMapping);
  }
}
