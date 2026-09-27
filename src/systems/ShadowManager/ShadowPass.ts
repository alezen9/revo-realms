import { Matrix4, NoToneMapping, Vector3, type Camera } from "three";
import type { Node, TextureNode, WebGPURenderer } from "three/webgpu";
import {
  float,
  getViewPosition,
  mix,
  renderOutput,
  screenUV,
  step,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import type { DebugFolder } from "../DebugManager";
import type { ScenePass } from "../RendererManager/ScenePass";
import {
  assetManager,
  lightingManager,
  monitoringManager,
  shadowCasterRegistry,
} from "..";
import {
  SHADOW_PAGE_TEXELS,
  getShadowReceiverLevel,
  getShadowLightPosition,
  getShadowPageCoordinate,
  getShadowPageKey,
  getShadowPageSize,
  getShadowPageTag,
  shadowResolutionBias,
  shadowSoftReceiverLevelBias,
} from "./ShadowPageCoordinates";
import { ShadowPageRequests } from "./ShadowPageRequests";
import { ShadowResidency } from "./ShadowResidency";
import { ShadowRigidAtlas } from "./ShadowRigidAtlas";

export class ShadowPass {
  private renderer: WebGPURenderer;
  private scene: ScenePass;
  private camera: Camera;
  private cameraWorldPosition = new Vector3();
  private shadowPageRequests: ShadowPageRequests;
  private shadowResidency: ShadowResidency;
  private shadowFixedAtlas: ShadowRigidAtlas;
  private shadowMovingAtlas: ShadowRigidAtlas;
  private uSunVisibility = uniform(1);
  private uShadowIntensity = uniform(0.7);
  private shadowFilter = {
    softness: uniform(0.5),
    lightSize: uniform(0.02),
    maxSoftness: uniform(6),
  };
  private uProjectionMatrixInverse = uniform(new Matrix4());
  private uCameraWorldMatrix = uniform(new Matrix4());
  private uCameraWorldPosition = uniform(this.cameraWorldPosition);

  constructor(renderer: WebGPURenderer, scene: ScenePass, camera: Camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.setCamera(camera);

    this.shadowPageRequests = new ShadowPageRequests(
      renderer,
      scene.depthTexture,
      this.uProjectionMatrixInverse,
      this.uCameraWorldMatrix,
      scene.softShadow.value,
      this.uCameraWorldPosition,
      lightingManager.uSunDir,
    );
    this.shadowResidency = new ShadowResidency(
      renderer,
      this.shadowPageRequests,
      this.uCameraWorldPosition,
      lightingManager.uSunDir,
    );
    this.shadowFixedAtlas = new ShadowRigidAtlas(
      renderer,
      this.shadowResidency,
      lightingManager.uSunDir,
      this.shadowFilter,
      "fixed",
    );
    this.shadowMovingAtlas = new ShadowRigidAtlas(
      renderer,
      this.shadowResidency,
      lightingManager.uSunDir,
      this.shadowFilter,
      "moving",
    );
    monitoringManager.setShadowPageStats(this.shadowResidency.stats);
  }

  setCamera(camera: Camera) {
    this.camera = camera;
    this.uProjectionMatrixInverse.value = camera.projectionMatrixInverse;
    this.uCameraWorldMatrix.value = camera.matrixWorld;
  }

  apply(sceneColor: TextureNode) {
    return this.resolveShadows(sceneColor.sample(screenUV), screenUV);
  }

  render() {
    this.camera.getWorldPosition(this.cameraWorldPosition);
    const requestNodes = this.shadowPageRequests.takeComputeNodes(
      this.camera,
      lightingManager.sunDirection,
      shadowCasterRegistry.fixedVersion +
        shadowCasterRegistry.fixedRevision +
        shadowCasterRegistry.movingVersion +
        shadowCasterRegistry.deformedVersion,
    );
    const { min, max } = assetManager.resources.heightmap.userData;
    if (typeof min !== "number" || typeof max !== "number")
      throw new Error("Shadows require terrain height bounds");
    this.shadowFixedAtlas.syncCasters(
      shadowCasterRegistry,
      lightingManager.sunDirection,
      { min, max },
    );
    this.shadowMovingAtlas.syncCasters(
      shadowCasterRegistry,
      lightingManager.sunDirection,
      { min, max },
    );
    const residencyNodes = this.shadowResidency.takeComputeNodes(
      lightingManager.sunDirection,
      requestNodes.length > 0,
    );
    const hasPageWork = residencyNodes.length > 0;
    const computeNodes = [
      ...requestNodes,
      ...residencyNodes,
      ...(hasPageWork ? this.shadowFixedAtlas.takeComputeNodes() : []),
      ...this.shadowMovingAtlas.takeComputeNodes(),
    ];
    if (computeNodes.length > 0) this.renderer.compute(computeNodes);
    this.shadowMovingAtlas.render();
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
    folder.addBinding(shadowSoftReceiverLevelBias, "value", {
      label: "Soft receiver blur level",
      min: 0,
      max: 4,
      step: 1,
    });
    folder.addBinding(shadowResolutionBias, "value", {
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
      Shadow: this.makeRigidShadowOutput(
        this.shadowFixedAtlas,
        this.shadowMovingAtlas,
      ),
      Receivers: this.makeReceiverOutput(),
      "Dynamic pages": this.makeDynamicPageOutput(),
      "Page heat": this.makePageHeatOutput(),
    };
  }

  private resolveShadows(sceneColor: Node<"vec4">, uv: Node<"vec2">) {
    const visibility = this.computeShadowVisibility(
      uv,
      this.shadowFixedAtlas,
      this.shadowMovingAtlas,
    );
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
      this.uProjectionMatrixInverse,
    );
    const worldPosition = this.uCameraWorldMatrix.mul(
      vec4(viewPosition, 1),
    ).xyz;
    return {
      depth,
      worldPosition,
      viewDistance: viewPosition.length(),
      isSoftReceiver: this.isSoftShadowReceiver(uv),
    };
  }

  private getDebugPage() {
    const { depth, worldPosition, viewDistance, isSoftReceiver } =
      this.getReceiver(screenUV);
    const level = getShadowReceiverLevel(viewDistance, isSoftReceiver);
    const pagePosition = getShadowLightPosition(
      worldPosition,
      lightingManager.uSunDir,
    ).div(getShadowPageSize(level));
    const pageCoordinate = getShadowPageCoordinate(pagePosition);
    return {
      depth,
      level,
      pagePosition,
      pageKey: getShadowPageKey(level, pageCoordinate),
      pageTag: getShadowPageTag(pageCoordinate),
    };
  }

  private makePageOutput() {
    const { depth, level, pagePosition, pageKey, pageTag } =
      this.getDebugPage();
    const { isResident } = this.shadowResidency.resolvePage(pageKey, pageTag);
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
      this.shadowResidency.resolvePage(pageKey, pageTag);
    const pageUv = pagePosition
      .fract()
      .clamp(0.5 / SHADOW_PAGE_TEXELS, 1 - 0.5 / SHADOW_PAGE_TEXELS);
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

  private makeRigidShadowOutput(
    atlas: ShadowRigidAtlas,
    secondary?: ShadowRigidAtlas,
  ) {
    const visibility = this.computeShadowVisibility(screenUV, atlas, secondary);
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
    const { hasDynamic } = this.shadowResidency.resolvePage(pageKey, pageTag);
    const color = depth
      .greaterThanEqual(1)
      .select(vec3(0), hasDynamic.select(vec3(1, 0.8, 0.1), vec3(0.25)));
    return renderOutput(vec4(color, 1), NoToneMapping);
  }

  private makePageHeatOutput() {
    const { depth, pageKey, pageTag } = this.getDebugPage();
    const { slot, isResident } = this.shadowResidency.resolvePage(
      pageKey,
      pageTag,
    );
    const age = this.shadowResidency.frame.sub(
      this.shadowResidency.slotRenderFramesNode.element(slot),
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

  private computeShadowVisibility(
    uv: Node<"vec2">,
    atlas: ShadowRigidAtlas,
    secondary?: ShadowRigidAtlas,
  ) {
    const { depth, worldPosition, viewDistance, isSoftReceiver } =
      this.getReceiver(uv);
    return atlas.computeVisibility(
      worldPosition,
      depth,
      viewDistance,
      isSoftReceiver,
      secondary,
    );
  }

  private isSoftShadowReceiver(uv: Node<"vec2">) {
    return this.scene.softShadow.sample(uv).r.greaterThan(0.5);
  }
}
