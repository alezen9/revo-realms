import {
  Matrix4,
  NoToneMapping,
  OrthographicCamera,
  Vector3,
  type Camera,
  type Mesh,
  type Scene,
} from "three";
import type {
  ComputeNode,
  Node,
  TextureNode,
  WebGPURenderer,
} from "three/webgpu";
import {
  float,
  getViewPosition,
  mix,
  mrt,
  pass,
  positionWorld,
  renderOutput,
  screenUV,
  step,
  uint,
  uniform,
  uvec2,
  vec2,
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
import { VSMVolumetricLight } from "./VSMVolumetricLight";
import {
  VSM_PAGE_TEXELS,
  getLightPosition,
  getPageCoordinate,
  getPageKey,
  getPageSize,
  getPageTag,
  getWindowCenter,
  isPageInWindow,
  VSM_LEVEL_COUNT,
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
const CAMERA_FOOTPRINT_COLOR = vec3(1, 0.85, 0.1);
const SUN_VIEW_DISTANCE = 3000;
const SUN_VIEW_RANGE = 190;
const SUN_VIEWS = new Set(["Sun view", "Sun view pages"]);

const getOutlinedPageColor = (level: Node<"uint">, pageUv: Node<"vec2">) => {
  const levelHue = LEVEL_HUE_STEPS.mul(float(level)).fract();
  const pageColor = levelHue.mul(0.6).add(0.3);
  const edgeOffset = pageUv.min(float(1).sub(pageUv));
  const edgeDistance = edgeOffset.x.min(edgeOffset.y);
  const edgeHighlight = step(edgeDistance, 0.025).mul(0.7);
  return mix(pageColor, PAGE_EDGE_COLOR, edgeHighlight);
};

const formatLegend = (entries: [color: string, meaning: string][]) => {
  const lines: string[] = [];
  for (const [color, meaning] of entries) lines.push(color.padEnd(9) + meaning);
  return lines.join("\n");
};

export type VSMDependencies = {
  lighting: Lighting;
  assets: Assets;
  performanceMonitor: PerformanceMonitor;
};

export class VSMPass {
  readonly volumetricLight: VSMVolumetricLight;
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
  private uShadowIntensity = uniform(0.8);
  private terrainBounds = { min: 0, max: 0 };
  private computeNodes: ComputeNode[] = [];
  private sunView = { size: 60 };
  private isSunViewActive = false;
  private sunViewCamera = new OrthographicCamera(
    -1,
    1,
    1,
    -1,
    1,
    SUN_VIEW_DISTANCE * 2,
  );
  private sunViewFocus = new Vector3();
  private uSunViewFocus = uniform(new Vector3());
  private uSunViewProjectionInverse = uniform(new Matrix4());
  private uSunViewCameraWorld = uniform(new Matrix4());
  private uMainViewProjection = uniform(new Matrix4());

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
    this.volumetricLight = new VSMVolumetricLight(
      renderer,
      camera,
      this.context,
      this.sampler,
      lighting,
    );
    performanceMonitor.setShadowPageStats(this.pages.stats);
  }

  setCamera(camera: Camera) {
    this.camera = camera;
    this.context.setCamera(camera);
    this.volumetricLight.setCamera(camera);
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
    if (this.isSunViewActive) this.updateSunView();
  }

  setDebugView(view: string) {
    this.isSunViewActive = SUN_VIEWS.has(view);
  }

  sampleShadowedColor(uv: Node<"vec2">) {
    return this.resolveShadows(this.scene.output.sample(uv), uv);
  }

  addBindings(folder: DebugFolder) {
    folder.addBinding(this.uShadowIntensity, "value", {
      label: "Intensity",
      min: 0,
      max: 1,
      step: 0.05,
    });
    folder.addBinding(this.sampler.filter.lightSize, "value", {
      label: "Light size",
      min: 0,
      max: 0.1,
      step: 0.001,
    });
    folder.addBinding(this.sampler.filter.maxSoftness, "value", {
      label: "Max softness",
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
      label: "Resolution bias",
      min: 0,
      max: 4,
      step: 1,
    });
    folder.addBinding(this.sunView, "size", {
      label: "Sun view size",
      min: 5,
      max: 1500,
      step: 1,
    });
  }

  createDebugLegends(): Record<string, string> {
    return {
      Pages: formatLegend([
        ["WHITE", "page border"],
        ["RED", "missing page"],
        ["COLORS", "clipmap level"],
        ["------", ""],
        ["GREY", "level 0, 0.5 m pages"],
        ["STEEL", "level 1, 1 m"],
        ["LILAC", "level 2, 2 m"],
        ["MINT", "level 3, 4 m"],
        ["BEIGE", "level 4, 8 m"],
        ["PINK", "level 5, 16 m"],
        ["SKY", "level 6, 32 m"],
      ]),
      "Page heat": formatLegend([
        ["RED", "drawn this frame"],
        ["ORANGE", "last 10 frames"],
        ["YELLOW", "last 30 frames"],
        ["GREEN", "last 120 frames"],
        ["BLUE", "older, cached"],
        ["MAGENTA", "missing page"],
      ]),
      Shadow: formatLegend([
        ["WHITE", "lit"],
        ["BLACK", "shadow"],
        ["GREY", "penumbra"],
      ]),
      "Static depth": formatLegend([
        ["GREY", "caster, darker is higher"],
        ["WHITE", "no caster"],
        ["RED", "missing page"],
      ]),
      "Dynamic depth": formatLegend([
        ["GREY", "moving caster, darker is higher"],
        ["WHITE", "no caster in page"],
        ["RED", "no moving page"],
      ]),
    };
  }

  createDebugOutputs(scene: Scene) {
    return {
      Pages: this.makePageOutput(),
      "Page heat": this.makePageHeatOutput(),
      Shadow: renderOutput(
        vec4(vec3(this.sampler.resolveVisibility(screenUV)), 1),
        NoToneMapping,
      ),
      "Static depth": this.makeDepthOutput(this.staticCache, false),
      "Dynamic depth": this.makeDepthOutput(this.dynamicLayer.pool, true),
      "Volumetric light": renderOutput(
        vec4(this.volumetricLight.sample(), 1),
        NoToneMapping,
      ),
      ...this.makeSunViewOutputs(scene),
    };
  }

  private resolveShadows(sceneColor: Node<"vec4">, uv: Node<"vec2">) {
    const visibility = this.sampler.resolveVisibility(uv);
    const directSun = this.scene.directSun.sample(uv).rgb;
    const shadowVisibility = mix(float(1), visibility, this.uShadowIntensity);
    const sunOcclusion = float(1).sub(shadowVisibility);
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
    const outlinedPageColor = getOutlinedPageColor(level, pagePosition.fract());
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

  private updateSunView() {
    const { width, height } = this.renderer.domElement;
    const aspect = width / height;
    const { size } = this.sunView;
    const camera = this.sunViewCamera;
    camera.left = -size * aspect;
    camera.right = size * aspect;
    camera.top = size;
    camera.bottom = -size;
    camera.updateProjectionMatrix();
    const focus = this.sunViewFocus;
    this.camera.getWorldPosition(focus);
    this.uSunViewFocus.value.copy(focus);
    camera.position.copy(this.lighting.sunDirection);
    camera.position.multiplyScalar(-SUN_VIEW_DISTANCE);
    camera.position.add(focus);
    camera.lookAt(focus);
    camera.updateMatrixWorld();
    this.uSunViewProjectionInverse.value.copy(camera.projectionMatrixInverse);
    this.uSunViewCameraWorld.value.copy(camera.matrixWorld);
    this.uMainViewProjection.value.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse,
    );
  }

  private makeSunViewOutputs(scene: Scene) {
    const sunViewDepth = positionWorld
      .sub(this.uSunViewFocus)
      .dot(this.lighting.uSunDir)
      .div(SUN_VIEW_RANGE * 2)
      .add(0.5)
      .clamp();
    const sunViewPass = pass(scene, this.sunViewCamera);
    sunViewPass.setMRT(mrt({ output: vec4(vec3(sunViewDepth), 1) }));
    const sunView = sunViewPass.getTextureNode("output");
    const sunViewPixelDepth = sunViewPass
      .getTextureNode("depth")
      .sample(screenUV).r;
    const sunViewSurface = getViewPosition(
      screenUV,
      sunViewPixelDepth,
      this.uSunViewProjectionInverse,
    );
    const sunSurfaceWorld = this.uSunViewCameraWorld.mul(
      vec4(sunViewSurface, 1),
    ).xyz;
    const requestedPages = this.getRequestedPageColor(sunSurfaceWorld);
    const mainClip = this.uMainViewProjection.mul(vec4(sunSurfaceWorld, 1));
    const mainNdc = mainClip.xy.div(mainClip.w);
    const mainUv = vec2(
      mainNdc.x.mul(0.5).add(0.5),
      mainNdc.y.mul(-0.5).add(0.5),
    );
    const isInsideMainView = mainClip.w
      .greaterThan(0)
      .and(mainUv.greaterThanEqual(vec2(0)).all())
      .and(mainUv.lessThanEqual(vec2(1)).all());
    const mainSurfaceWorld = this.sampler.getReceiver(mainUv).worldPosition;
    const cameraDistance = sunSurfaceWorld.distance(this.uSunViewFocus);
    const footprintTolerance = cameraDistance.mul(0.02).add(0.15);
    const isSeenByCamera = isInsideMainView.and(
      mainSurfaceWorld.distance(sunSurfaceWorld).lessThan(footprintTolerance),
    );
    const pageCoverage = requestedPages.coverage.mul(sunView.a);
    const footprintCoverage = float(isSeenByCamera).mul(sunView.a);
    const sunViewBase = mix(vec3(1), sunView.rgb, sunView.a);
    const sunViewWithPages = mix(
      sunViewBase,
      requestedPages.color,
      pageCoverage.mul(0.6),
    );
    const sunViewWithFootprint = mix(
      sunViewWithPages,
      CAMERA_FOOTPRINT_COLOR,
      footprintCoverage.mul(0.45),
    );
    return {
      "Sun view": renderOutput(vec4(sunViewBase, 1), NoToneMapping),
      "Sun view pages": renderOutput(
        vec4(sunViewWithFootprint, 1),
        NoToneMapping,
      ),
    };
  }

  private getRequestedPageColor(worldPosition: Node<"vec3">) {
    const { cameraPosition, lightBasis } = this.context;
    const requestBits = this.pages.createRequestReadNode();
    const lightPosition = getLightPosition(worldPosition, lightBasis);
    let color: Node<"vec3"> = vec3(0);
    let coverage: Node<"float"> = float(0);
    for (let levelIndex = VSM_LEVEL_COUNT - 1; levelIndex >= 0; levelIndex--) {
      const level = uint(levelIndex);
      const pagePosition = lightPosition.div(getPageSize(level));
      const pageCoordinate = getPageCoordinate(pagePosition);
      const pageKey = getPageKey(level, pageCoordinate);
      const word = requestBits.element(pageKey.div(32));
      const bit = uint(1).shiftLeft(pageKey.mod(32));
      const hasBit = word.bitAnd(bit).notEqual(0);
      const windowCenter = getWindowCenter(cameraPosition, lightBasis, level);
      const isInWindow = isPageInWindow(pageCoordinate, windowCenter);
      const isRequested = float(hasBit.and(isInWindow));
      const pageColor = getOutlinedPageColor(level, pagePosition.fract());
      color = mix(color, pageColor, isRequested);
      coverage = coverage.max(isRequested);
    }
    return { color, coverage };
  }
}
