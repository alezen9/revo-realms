import { NoToneMapping, type Camera, type Mesh } from "three";
import type { Node, TextureNode, WebGPURenderer } from "three/webgpu";
import {
  float,
  mix,
  renderOutput,
  screenUV,
  step,
  uniform,
  uvec2,
  vec3,
  vec4,
} from "three/tsl";
import type { DebugFolder } from "../DebugManager";
import type { ScenePass } from "../RendererManager/ScenePass";
import { assetManager, lightingManager, monitoringManager } from "..";
import { VSMContext, type VSMCasterOptions } from "./VSMContext";
import { VSMDynamicLayer } from "./VSMDynamicLayer";
import {
  VSM_PAGE_TEXELS,
  getLightPosition,
  getPageCoordinate,
  getPageKey,
  getPageSize,
  getPageTag,
  getReceiverLevel,
  vsmResolutionBias,
  vsmSoftReceiverLevelBias,
} from "./VSMMath";
import { VSMPages } from "./VSMPages";
import { VSMSampler, type VSMDepthLayer } from "./VSMSampler";
import { VSMStaticCache } from "./VSMStaticCache";

export class VSMPass {
  private renderer: WebGPURenderer;
  private scene: ScenePass;
  private camera: Camera;
  private context: VSMContext;
  private pages: VSMPages;
  private staticCache: VSMStaticCache;
  private dynamicLayer: VSMDynamicLayer;
  private sampler: VSMSampler;
  private uSunVisibility = uniform(1);
  private uShadowIntensity = uniform(0.7);

  constructor(renderer: WebGPURenderer, scene: ScenePass, camera: Camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.context = new VSMContext(renderer, lightingManager.uSunDir);
    this.context.setCamera(camera);
    this.pages = new VSMPages(
      renderer,
      this.context,
      scene.depthTexture,
      scene.softShadow.value,
    );
    this.staticCache = new VSMStaticCache(this.context);
    this.dynamicLayer = new VSMDynamicLayer(renderer, this.context);
    this.sampler = new VSMSampler(
      this.context,
      scene,
      this.staticCache,
      this.dynamicLayer,
    );
    monitoringManager.setShadowPageStats(this.pages.stats);
    monitoringManager.setShadowCasterCounts(this.context.casterCounts);
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

  markCasterMoved(mesh: Mesh) {
    this.context.markCasterMoved(mesh);
  }

  setCasterDepthBias(mesh: Mesh, depthBias: number) {
    this.context.setCasterDepthBias(mesh, depthBias);
  }

  apply(sceneColor: TextureNode) {
    return this.resolveShadows(sceneColor.sample(screenUV), screenUV);
  }

  render() {
    this.context.beginFrame(this.camera, lightingManager.sunDirection);
    const { min, max } = assetManager.resources.heightmap.userData;
    if (typeof min !== "number" || typeof max !== "number")
      throw new Error("Shadows require terrain height bounds");
    this.staticCache.sync({ min, max });
    this.dynamicLayer.sync({ min, max });
    const requestNodes = this.pages.getRequestNodes();
    const residencyNodes = this.pages.getResidencyNodes();
    const hasAllocations = residencyNodes.length > 0;
    const staticNodes = hasAllocations
      ? this.staticCache.getComputeNodes()
      : [];
    this.renderer.compute([
      ...requestNodes,
      ...residencyNodes,
      ...staticNodes,
      ...this.dynamicLayer.getComputeNodes(),
    ]);
    this.dynamicLayer.render();
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
      "Direct sun": renderOutput(
        vec4(this.scene.directSun.sample(screenUV).rgb, 1),
        NoToneMapping,
      ),
      Pages: this.makePageOutput(),
      "Fixed depth": this.makeDepthOutput(this.staticCache, false),
      "Moving depth": this.makeDepthOutput(this.dynamicLayer, true),
      "Fixed shadow": this.makeVisibilityOutput(
        this.sampler.resolveStaticVisibility(screenUV),
      ),
      "Moving shadow": this.makeVisibilityOutput(
        this.sampler.resolveDynamicVisibility(screenUV),
      ),
      Shadow: this.makeVisibilityOutput(
        this.sampler.resolveVisibility(screenUV),
      ),
      Receivers: this.makeReceiverOutput(),
      "Dynamic pages": this.makeDynamicPageOutput(),
      "Page heat": this.makePageHeatOutput(),
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
    const isSoftReceiver = this.sampler.isSoftReceiver(screenUV);
    const level = getReceiverLevel(viewDistance, isSoftReceiver);
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

  private makeDepthOutput(layer: VSMDepthLayer, isDynamic: boolean) {
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

  private makeVisibilityOutput(visibility: Node<"float">) {
    return renderOutput(vec4(vec3(visibility), 1), NoToneMapping);
  }

  private makeReceiverOutput() {
    const depth = this.scene.depth.sample(screenUV).r;
    const directSun = this.scene.directSun.sample(screenUV).rgb;
    const receiverColor = this.sampler
      .isSoftReceiver(screenUV)
      .select(vec3(0.2, 0.45, 1), vec3(0.2, 0.85, 0.3));
    const isReceiver = directSun.dot(vec3(1)).greaterThan(0);
    const color = depth
      .greaterThanEqual(1)
      .select(vec3(0.15), isReceiver.select(receiverColor, vec3(0)));
    return renderOutput(vec4(color, 1), NoToneMapping);
  }

  private makeDynamicPageOutput() {
    const { depth, pageKey, pageTag } = this.getDebugPage();
    const { hasDynamic } = this.context.resolvePage(pageKey, pageTag);
    const color = depth
      .greaterThanEqual(1)
      .select(vec3(0), hasDynamic.select(vec3(1, 0.8, 0.1), vec3(0.25)));
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
