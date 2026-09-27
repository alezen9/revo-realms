import { NoToneMapping, type Camera, type Mesh } from "three";
import type { Node, TextureNode, WebGPURenderer } from "three/webgpu";
import {
  Fn,
  If,
  bool,
  float,
  getViewPosition,
  mix,
  renderOutput,
  screenSize,
  screenUV,
  step,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { DebugFolder } from "../DebugManager";
import type { ScenePass } from "../RendererManager/ScenePass";
import { TexturePass } from "../RendererManager/TexturePass";
import { assetManager, lightingManager, monitoringManager } from "..";
import {
  VSM_PAGE_TEXELS,
  getReceiverLevel,
  getLightPosition,
  getPageCoordinate,
  getPageKey,
  getPageSize,
  getPageTag,
  vsmResolutionBias,
  vsmSoftReceiverLevelBias,
} from "./VSMMath";
import { ShadowRigidAtlas } from "./ShadowRigidAtlas";
import { VSMContext, type VSMCasterOptions } from "./VSMContext";
import { VSMPages } from "./VSMPages";

type FloatNode = Node<"float">;
type Vec2Node = Node<"vec2">;
type Vec4Node = Node<"vec4">;

type SoftSampleArgs = [
  softSample: Vec4Node,
  bilinearWeight: FloatNode,
  viewDistance: FloatNode,
];

type SoftUpsampleArgs = [
  softVisibility: TextureNode,
  softVisibilitySize: Vec2Node,
  uv: Vec2Node,
  viewDistance: FloatNode,
];

const SOFT_VISIBILITY_SCALE = 0.5;
const SOFT_DEPTH_SHARPNESS = 64;

const weighSoftSample = Fn<SoftSampleArgs, Vec2Node>(
  ([softSample, bilinearWeight, viewDistance]) => {
    const relativeDistance = softSample.y
      .sub(viewDistance)
      .abs()
      .div(viewDistance.max(0.001));
    const depthWeight = float(1).div(
      relativeDistance.mul(SOFT_DEPTH_SHARPNESS).add(1),
    );
    const weight = bilinearWeight.mul(depthWeight).max(0.0001);
    return vec2(softSample.x.mul(weight), weight);
  },
);

const upsampleSoftVisibility = Fn<SoftUpsampleArgs, FloatNode>(
  ([softVisibility, softVisibilitySize, uv, viewDistance]) => {
    const texelPosition = uv.mul(softVisibilitySize).sub(0.5);
    const baseTexel = texelPosition.floor();
    const blend = texelPosition.sub(baseTexel);
    const inverseBlend = vec2(1).sub(blend);
    const topLeftUv = baseTexel.add(vec2(0.5, 0.5)).div(softVisibilitySize);
    const topRightUv = baseTexel.add(vec2(1.5, 0.5)).div(softVisibilitySize);
    const bottomLeftUv = baseTexel.add(vec2(0.5, 1.5)).div(softVisibilitySize);
    const bottomRightUv = baseTexel.add(vec2(1.5, 1.5)).div(softVisibilitySize);
    const topLeft = weighSoftSample(
      softVisibility.sample(topLeftUv),
      inverseBlend.x.mul(inverseBlend.y),
      viewDistance,
    );
    const topRight = weighSoftSample(
      softVisibility.sample(topRightUv),
      blend.x.mul(inverseBlend.y),
      viewDistance,
    );
    const bottomLeft = weighSoftSample(
      softVisibility.sample(bottomLeftUv),
      inverseBlend.x.mul(blend.y),
      viewDistance,
    );
    const bottomRight = weighSoftSample(
      softVisibility.sample(bottomRightUv),
      blend.x.mul(blend.y),
      viewDistance,
    );
    const weightedSum = topLeft.add(topRight).add(bottomLeft).add(bottomRight);
    return weightedSum.x.div(weightedSum.y);
  },
);

export class VSMPass {
  private renderer: WebGPURenderer;
  private scene: ScenePass;
  private camera: Camera;
  private context: VSMContext;
  private pages: VSMPages;
  private shadowFixedAtlas: ShadowRigidAtlas;
  private shadowMovingAtlas: ShadowRigidAtlas;
  private uSunVisibility = uniform(1);
  private uShadowIntensity = uniform(0.7);
  private shadowFilter = {
    softness: uniform(0.5),
    lightSize: uniform(0.02),
    maxSoftness: uniform(4.5),
  };
  private softVisibilityPass: TexturePass;
  private softVisibility: TextureNode;
  private uSoftVisibilitySize: Node<"vec2">;

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
    this.shadowFixedAtlas = new ShadowRigidAtlas(
      renderer,
      this.context,
      lightingManager.uSunDir,
      this.shadowFilter,
      "fixed",
    );
    this.shadowMovingAtlas = new ShadowRigidAtlas(
      renderer,
      this.context,
      lightingManager.uSunDir,
      this.shadowFilter,
      "moving",
    );
    monitoringManager.setShadowPageStats(this.pages.stats);
    monitoringManager.setShadowCasterCounts(this.context.casterCounts);

    this.softVisibilityPass = new TexturePass(
      renderer,
      "Soft shadow visibility",
      SOFT_VISIBILITY_SCALE,
    );
    this.uSoftVisibilitySize = uniform(this.softVisibilityPass.size);
    this.softVisibility = this.softVisibilityPass.apply(
      this.resolveSoftVisibility(),
    );
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
    this.shadowFixedAtlas.sync({ min, max });
    this.shadowMovingAtlas.sync({ min, max });
    const requestNodes = this.pages.getRequestNodes();
    const residencyNodes = this.pages.getResidencyNodes();
    const hasPageWork = residencyNodes.length > 0;
    const computeNodes = [
      ...requestNodes,
      ...residencyNodes,
      ...(hasPageWork ? this.shadowFixedAtlas.takeComputeNodes() : []),
      ...this.shadowMovingAtlas.takeComputeNodes(),
    ];
    if (computeNodes.length > 0) this.renderer.compute(computeNodes);
    this.shadowMovingAtlas.render();
    this.softVisibilityPass.render();
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
    folder.addBinding(this.shadowFilter.softness, "value", {
      label: "Shadow softness",
      min: 0,
      max: 3,
      step: 0.05,
    });
    folder.addBinding(this.shadowFilter.lightSize, "value", {
      label: "Shadow light size",
      min: 0,
      max: 0.1,
      step: 0.001,
    });
    folder.addBinding(this.shadowFilter.maxSoftness, "value", {
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
      "Fixed depth": this.makeRigidDepthOutput(this.shadowFixedAtlas, false),
      "Moving depth": this.makeRigidDepthOutput(this.shadowMovingAtlas, true),
      "Fixed shadow": this.makeRigidShadowOutput(this.shadowFixedAtlas),
      "Moving shadow": this.makeRigidShadowOutput(this.shadowMovingAtlas),
      Shadow: renderOutput(
        vec4(vec3(this.resolveVisibility(screenUV)), 1),
        NoToneMapping,
      ),
      Receivers: this.makeReceiverOutput(),
      "Dynamic pages": this.makeDynamicPageOutput(),
      "Page heat": this.makePageHeatOutput(),
    };
  }

  private resolveVisibility = Fn<[uv: Vec2Node], FloatNode>(([uv]) => {
    const { depth, worldPosition, viewDistance } = this.getReceiver(uv);
    const receiverDepth = depth.toVar();
    const receiverWorldPosition = worldPosition.toVar();
    const receiverViewDistance = viewDistance.toVar();
    const visibility = float(1).toVar();
    If(this.isSoftShadowReceiver(uv), () => {
      visibility.assign(
        upsampleSoftVisibility(
          this.softVisibility,
          this.uSoftVisibilitySize,
          uv,
          receiverViewDistance,
        ),
      );
    }).Else(() => {
      visibility.assign(
        this.shadowFixedAtlas.computeVisibility(
          receiverWorldPosition,
          receiverDepth,
          receiverViewDistance,
          bool(false),
          this.shadowMovingAtlas,
        ),
      );
    });
    return visibility;
  });

  private resolveSoftVisibility() {
    const representativeUv = screenUV.sub(vec2(0.25).div(screenSize));
    const { depth, worldPosition, viewDistance } =
      this.getReceiver(representativeUv);
    const visibility = this.shadowFixedAtlas.computeVisibility(
      worldPosition,
      depth,
      viewDistance,
      bool(true),
      this.shadowMovingAtlas,
    );
    return vec4(visibility, viewDistance, 0, 1);
  }

  private resolveShadows(sceneColor: Node<"vec4">, uv: Node<"vec2">) {
    const visibility = this.resolveVisibility(uv);
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

  private getReceiver(uv: Node<"vec2">) {
    const depth = this.scene.depth.sample(uv).r;
    const viewPosition = getViewPosition(
      uv,
      depth,
      this.context.projectionMatrixInverse,
    );
    const worldPosition = this.context.cameraWorldMatrix.mul(
      vec4(viewPosition, 1),
    ).xyz;
    return {
      depth,
      worldPosition,
      viewDistance: viewPosition.length(),
    };
  }

  private getDebugPage() {
    const { depth, worldPosition, viewDistance } = this.getReceiver(screenUV);
    const isSoftReceiver = this.isSoftShadowReceiver(screenUV);
    const level = getReceiverLevel(viewDistance, isSoftReceiver);
    const pagePosition = getLightPosition(
      worldPosition,
      lightingManager.uSunDir,
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

  private makeRigidDepthOutput(atlas: ShadowRigidAtlas, isDynamic: boolean) {
    const { depth, pagePosition, pageKey, pageTag } = this.getDebugPage();
    const { slot, dynamicSlot, isResident, hasDynamic } =
      this.context.resolvePage(pageKey, pageTag);
    const pageUv = pagePosition
      .fract()
      .clamp(0.5 / VSM_PAGE_TEXELS, 1 - 0.5 / VSM_PAGE_TEXELS);
    const atlasDepth = atlas.sampleDebugDepth(
      isDynamic ? dynamicSlot : slot,
      pageUv,
    );
    const visualDepth = atlasDepth.sub(0.65).mul(5).clamp();
    const color = depth
      .greaterThanEqual(1)
      .select(
        vec3(0),
        (isDynamic ? hasDynamic : isResident).select(
          vec3(visualDepth),
          vec3(1, 0, 0),
        ),
      );
    return renderOutput(vec4(color, 1), NoToneMapping);
  }

  private makeRigidShadowOutput(atlas: ShadowRigidAtlas) {
    const { depth, worldPosition, viewDistance } = this.getReceiver(screenUV);
    const visibility = atlas.computeVisibility(
      worldPosition,
      depth,
      viewDistance,
      this.isSoftShadowReceiver(screenUV),
    );
    return renderOutput(vec4(vec3(visibility), 1), NoToneMapping);
  }

  private makeReceiverOutput() {
    const depth = this.scene.depth.sample(screenUV).r;
    const directSun = this.scene.directSun.sample(screenUV).rgb;
    const receiverColor = this.isSoftShadowReceiver(screenUV).select(
      vec3(0.2, 0.45, 1),
      vec3(0.2, 0.85, 0.3),
    );
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

  private isSoftShadowReceiver(uv: Node<"vec2">) {
    return this.scene.softShadow.sample(uv).r.greaterThan(0.5);
  }
}
