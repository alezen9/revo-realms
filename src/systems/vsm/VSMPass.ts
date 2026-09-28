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
import { assets, lighting, performanceMonitor } from "..";
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

export class VSMPass {
  private renderer: WebGPURenderer;
  private scene: ScenePass;
  private camera: Camera;
  private context: VSMContext;
  private pages: VSMPages;
  private staticCache: VSMDepthPool;
  private dynamicLayer: VSMDynamicLayer;
  private sampler: VSMSampler;
  private uSunVisibility = uniform(1);
  private uShadowIntensity = uniform(0.7);
  private terrainBounds = { min: 0, max: 0 };
  private computeNodes: ComputeNode[] = [];

  constructor(renderer: WebGPURenderer, scene: ScenePass, camera: Camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
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
    this.context.beginFrame(this.camera, lighting.sunDirection);
    const { min, max } = assets.resources.heightmap.userData;
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
    return sceneColor
      .sub(
        vec4(
          this.scene.directSun
            .sample(uv)
            .rgb.mul(
              float(1).sub(
                this.uSunVisibility.mul(
                  mix(float(1), visibility, this.uShadowIntensity),
                ),
              ),
            ),
          0,
        ),
      )
      .max(0);
  }

  private getDebugPage() {
    const { depth, worldPosition, viewDistance } =
      this.sampler.getReceiver(screenUV);
    const softness = this.sampler.getSoftness(screenUV);
    const level = softness
      .greaterThan(VSM_SOFT_RECEIVER_THRESHOLD)
      .select(
        uint(getSoftReceiverLevel(viewDistance, softness).floor()),
        getReceiverLevel(viewDistance),
      );
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
    const pageColor = vec3(
      float(level).mul(0.37).fract().mul(0.6).add(0.3),
      float(level).mul(0.61).fract().mul(0.6).add(0.3),
      float(level).mul(0.83).fract().mul(0.6).add(0.3),
    );
    const edgeDistance = pageUv.x
      .min(float(1).sub(pageUv.x))
      .min(pageUv.y)
      .min(float(1).sub(pageUv.y));
    const pageCoverage = isResident.select(
      mix(pageColor, vec3(1), step(edgeDistance, 0.025).mul(0.7)),
      vec3(1, 0, 0),
    );
    const color = depth.greaterThanEqual(1).select(vec3(0), pageCoverage);
    return renderOutput(vec4(color, 1), NoToneMapping);
  }

  private makeDepthOutput(layer: VSMDepthPool, isDynamic: boolean) {
    const { depth, pagePosition, pageKey, pageTag } = this.getDebugPage();
    const { slot, dynamicSlot, isResident, hasDynamic } =
      this.context.resolvePage(pageKey, pageTag);
    const texel = uvec2(
      pagePosition
        .fract()
        .mul(VSM_PAGE_TEXELS)
        .floor()
        .clamp(0, VSM_PAGE_TEXELS - 1),
    );
    const layerDepth = layer.loadDepth(isDynamic ? dynamicSlot : slot, texel);
    const visualDepth = layerDepth.sub(0.65).mul(5).clamp();
    const hasPage = isDynamic ? hasDynamic : isResident;
    const color = depth
      .greaterThanEqual(1)
      .select(vec3(0), hasPage.select(vec3(visualDepth), vec3(1, 0, 0)));
    return renderOutput(vec4(color, 1), NoToneMapping);
  }

  private makePageHeatOutput() {
    const { depth, pageKey, pageTag } = this.getDebugPage();
    const { slot, isResident } = this.context.resolvePage(pageKey, pageTag);
    const age = this.context.frame.sub(
      this.context.slotRenderFramesNode.element(slot),
    );
    const heatColor = age
      .lessThan(2)
      .select(
        vec3(1, 0.1, 0.05),
        age
          .lessThan(30)
          .select(
            vec3(1, 0.5, 0.05),
            age
              .lessThan(120)
              .select(
                vec3(0.95, 0.85, 0.1),
                age
                  .lessThan(600)
                  .select(vec3(0.2, 0.6, 0.3), vec3(0.12, 0.16, 0.3)),
              ),
          ),
      );
    const color = depth
      .greaterThanEqual(1)
      .select(vec3(0), isResident.select(heatColor, vec3(1, 0, 1)));
    return renderOutput(vec4(color, 1), NoToneMapping);
  }
}
