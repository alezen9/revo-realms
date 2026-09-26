import {
  ACESFilmicToneMapping,
  ColorManagement,
  Matrix4,
  NoToneMapping,
  Vector3,
} from "three";
import {
  NodeFrame,
  RedFormat,
  RenderPipeline,
  RGBFormat,
  UnsignedByteType,
  UnsignedInt101111Type,
  WebGPURenderer,
  type Node,
} from "three/webgpu";
import {
  float,
  getViewPosition,
  mix,
  mrt,
  output,
  pass,
  renderOutput,
  screenUV,
  step,
  texture,
  toneMapping,
  toneMappingExposure,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import type { DebugFolder, DebugManager } from "../DebugManager";
import type { EventsManager } from "../EventsManager";
import type { SceneManager } from "../SceneManager";
import {
  assetManager,
  lightingManager,
  monitoringManager,
  shadowCasterRegistry,
} from "..";
import {
  SHADOW_PAGE_TEXELS,
  getShadowDynamicLevel,
  getShadowReceiverLevel,
  getShadowLightPosition,
  getShadowPageCoordinate,
  getShadowPageKey,
  getShadowPageSize,
  getShadowPageTag,
  shadowResolutionBias,
  shadowSoftReceiverLevelBias,
} from "../ShadowManager/ShadowPageCoordinates";
import { ShadowPageRequests } from "../ShadowManager/ShadowPageRequests";
import { ShadowResidency } from "../ShadowManager/ShadowResidency";
import { ShadowRigidAtlas } from "../ShadowManager/ShadowRigidAtlas";

const MAIN_SCENE_PASS_SAMPLES = 4;
const LUMINANCE_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);

export class PostprocessingManager extends RenderPipeline {
  private mainScenePass: ReturnType<typeof pass>;
  private waterPass: ReturnType<typeof pass>;
  private mainSceneFrame = new NodeFrame();
  private cameraWorldPosition = new Vector3();
  private shadowPageRequests: ShadowPageRequests;
  private shadowResidency: ShadowResidency;
  private shadowFixedAtlas: ShadowRigidAtlas;
  private shadowMovingAtlas: ShadowRigidAtlas;
  private uSaturation = uniform(1);
  private uSunVisibility = uniform(1);
  private uShadowIntensity = uniform(0.7);
  private uShadowSoftness = uniform(0.5);
  private uProjectionMatrixInverse = uniform(new Matrix4());
  private uCameraWorldMatrix = uniform(new Matrix4());
  private uCameraWorldPosition = uniform(this.cameraWorldPosition);
  private saturationTarget = 1;
  private saturationLerpSpeed = 14;
  private sceneManager: SceneManager;
  private eventsManager: EventsManager;
  private debugManager: DebugManager;
  private debugFolder: DebugFolder;
  private debugView = {
    target: "scene",
  };
  private debugOutputs: Record<string, ReturnType<typeof renderOutput>>;

  constructor(
    renderer: WebGPURenderer,
    sceneManager: SceneManager,
    eventsManager: EventsManager,
    debugManager: DebugManager,
  ) {
    super(renderer);
    renderer.toneMappingExposure = 2;
    this.sceneManager = sceneManager;
    this.eventsManager = eventsManager;
    this.debugManager = debugManager;

    this.debugFolder = this.debugManager.panel.addFolder({
      title: "⭐️ Postprocessing",
      expanded: false,
    });
    this.mainScenePass = pass(
      this.sceneManager.mainScene,
      this.sceneManager.renderCamera,
      { samples: MAIN_SCENE_PASS_SAMPLES },
    );
    this.mainScenePass.setMRT(
      mrt({ output, directSun: vec4(0), softShadow: vec4(0) }),
    );
    const directSunTexture = this.mainScenePass.getTexture("directSun");
    directSunTexture.format = RGBFormat;
    directSunTexture.type = UnsignedInt101111Type;
    const softShadowTexture = this.mainScenePass.getTexture("softShadow");
    softShadowTexture.format = RedFormat;
    softShadowTexture.type = UnsignedByteType;
    this.waterPass = pass(
      this.sceneManager.waterScene,
      this.sceneManager.renderCamera,
      { samples: 0, depthBuffer: false },
    );
    this.mainScenePass.name = "Main scene";
    this.waterPass.name = "Water";
    const depthTexture = this.mainScenePass.renderTarget.depthTexture;
    if (!depthTexture) throw new Error("Shadows require scene depth");
    depthTexture.renderTarget = this.mainScenePass.renderTarget;

    this.syncCameraUniforms();

    this.shadowPageRequests = new ShadowPageRequests(
      renderer,
      depthTexture,
      this.uProjectionMatrixInverse,
      this.uCameraWorldMatrix,
      softShadowTexture,
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
      this.uShadowSoftness,
      "fixed",
    );
    this.shadowMovingAtlas = new ShadowRigidAtlas(
      renderer,
      this.shadowResidency,
      lightingManager.uSunDir,
      this.uShadowSoftness,
      "moving",
    );
    monitoringManager.setShadowPageStats(this.shadowResidency.stats);

    this.debugOutputs = {
      scene: this.makeGraph(),
      directSun: renderOutput(
        vec4(this.getMainSceneTextureNode("directSun").sample(screenUV).rgb, 1),
        NoToneMapping,
      ),
      pages: this.makePageOutput(),
      fixedDepth: this.makeRigidDepthOutput(this.shadowFixedAtlas, false),
      movingDepth: this.makeRigidDepthOutput(this.shadowMovingAtlas, true),
      fixedShadow: this.makeRigidShadowOutput(this.shadowFixedAtlas),
      movingShadow: this.makeRigidShadowOutput(this.shadowMovingAtlas),
      shadow: this.makeRigidShadowOutput(
        this.shadowFixedAtlas,
        this.shadowMovingAtlas,
      ),
      receivers: this.makeReceiverOutput(),
      dynamicPages: this.makeDynamicPageOutput(),
    };
    this.addShadowBindings();
    this.debugFolder
      .addBinding(this.debugView, "target", {
        label: "View",
        options: {
          Scene: "scene",
          "Direct sun": "directSun",
          Pages: "pages",
          "Fixed depth": "fixedDepth",
          "Moving depth": "movingDepth",
          "Fixed shadow": "fixedShadow",
          "Moving shadow": "movingShadow",
          Shadow: "shadow",
          Receivers: "receivers",
          "Dynamic pages": "dynamicPages",
        },
      })
      .on("change", this.selectDebugView);
    this.selectDebugView();

    this.eventsManager.on("engine-camera-change", () => {
      this.mainScenePass.camera = this.sceneManager.renderCamera;
      this.mainScenePass.needsUpdate = true;
      this.waterPass.camera = this.sceneManager.renderCamera;
      this.waterPass.needsUpdate = true;
      this.syncCameraUniforms();
    });

    this.eventsManager.on("engine-slowmo-change", (enabled: boolean) => {
      this.saturationTarget = enabled ? 0 : 1;
    });

    this.eventsManager.on("engine-render-update", ({ delta }) => {
      if (this.uSaturation.value === this.saturationTarget) return;
      const t = 1 - Math.exp(-this.saturationLerpSpeed * delta);
      this.uSaturation.value +=
        (this.saturationTarget - this.uSaturation.value) * t;
    });
  }

  private addShadowBindings() {
    this.debugFolder.addBinding(this.uSunVisibility, "value", {
      label: "Sun visibility",
      min: 0,
      max: 1,
      step: 0.05,
    });
    this.debugFolder.addBinding(this.uShadowIntensity, "value", {
      label: "Shadow intensity",
      min: 0,
      max: 1,
      step: 0.05,
    });
    this.debugFolder.addBinding(this.uShadowSoftness, "value", {
      label: "Shadow softness",
      min: 0,
      max: 3,
      step: 0.05,
    });
    this.debugFolder.addBinding(shadowSoftReceiverLevelBias, "value", {
      label: "Soft receiver blur level",
      min: 0,
      max: 4,
      step: 1,
    });
    this.debugFolder.addBinding(shadowResolutionBias, "value", {
      label: "Shadow resolution bias",
      min: 0,
      max: 4,
      step: 1,
    });
  }

  private syncCameraUniforms() {
    const camera = this.sceneManager.renderCamera;
    this.uProjectionMatrixInverse.value = camera.projectionMatrixInverse;
    this.uCameraWorldMatrix.value = camera.matrixWorld;
  }

  private selectDebugView = () => {
    this.outputNode =
      this.debugOutputs[this.debugView.target] ?? this.debugOutputs.scene;
    this.needsUpdate = true;
  };

  private getReceiver(uv: Node<"vec2">) {
    const depth = this.getMainSceneTextureNode("depth").sample(uv).r;
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

  private getDebugPage(isDynamic: boolean) {
    const { depth, worldPosition, viewDistance, isSoftReceiver } =
      this.getReceiver(screenUV);
    const receiverLevel = getShadowReceiverLevel(viewDistance, isSoftReceiver);
    const level = isDynamic
      ? getShadowDynamicLevel(receiverLevel)
      : receiverLevel;
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
      this.getDebugPage(false);
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
    const { depth, pagePosition, pageKey, pageTag } =
      this.getDebugPage(isDynamic);
    const { slot, isResident } = this.shadowResidency.resolvePage(
      pageKey,
      pageTag,
    );
    const pageUv = pagePosition
      .fract()
      .clamp(0.5 / SHADOW_PAGE_TEXELS, 1 - 0.5 / SHADOW_PAGE_TEXELS);
    const atlasDepth = atlas.sampleDebugDepth(slot, pageUv);
    const visualDepth = atlasDepth.sub(0.65).mul(5).clamp();
    const color = depth
      .greaterThanEqual(1)
      .select(vec3(0), isResident.select(vec3(visualDepth), vec3(1, 0, 0)));
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
    const depth = this.getMainSceneTextureNode("depth").sample(screenUV).r;
    const directSun =
      this.getMainSceneTextureNode("directSun").sample(screenUV).rgb;
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
    const { depth, pageKey, pageTag } = this.getDebugPage(true);
    const { hasDynamic } = this.shadowResidency.resolvePage(pageKey, pageTag);
    const color = depth
      .greaterThanEqual(1)
      .select(vec3(0), hasDynamic.select(vec3(1, 0.8, 0.1), vec3(0.25)));
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

  sampleMainSceneColor(uv: Node<"vec2">) {
    const sceneColor = this.getMainSceneTextureNode().sample(uv);
    const visibility = this.computeShadowVisibility(
      uv,
      this.shadowFixedAtlas,
      this.shadowMovingAtlas,
    );
    return sceneColor
      .sub(
        vec4(
          this.getMainSceneTextureNode("directSun")
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

  private isSoftShadowReceiver(uv: Node<"vec2">) {
    return this.getMainSceneTextureNode("softShadow")
      .sample(uv)
      .r.greaterThan(0.5);
  }

  get mainSceneDepthNode() {
    return this.getMainSceneTextureNode("depth");
  }

  private getMainSceneTextureNode(name = "output") {
    if (name === "depth") {
      const depthTexture = this.mainScenePass.renderTarget.depthTexture;
      if (!depthTexture) throw new Error("Shadows require scene depth");
      return texture(depthTexture);
    }
    return texture(this.mainScenePass.getTexture(name));
  }

  private makeGraph() {
    this.outputColorTransform = false;
    const resolvedSceneColor = this.sampleMainSceneColor(screenUV);
    const water = this.waterPass.getTextureNode();
    const colorHDR = mix(resolvedSceneColor, vec4(water.rgb, 1), water.a);

    const bloomPass = bloom(colorHDR, 0.25, 0.15, 1);
    bloomPass.smoothWidth.value = 0.04;
    // @ts-expect-error I know its private but looks good enough and reduces workload
    bloomPass._nMips = 2;

    this.debugFolder.addBinding(bloomPass.strength, "value", {
      label: "Bloom strength",
    });
    this.debugFolder.addBinding(bloomPass.threshold, "value", {
      label: "Bloom threshold",
    });
    this.debugFolder.addBinding(this.renderer, "toneMappingExposure", {
      label: "Exposure",
      min: 0,
      max: 10,
      step: 0.01,
    });

    const toneMapped = toneMapping(
      ACESFilmicToneMapping,
      toneMappingExposure,
      colorHDR.add(bloomPass),
    ).rgb;
    const luminance = toneMapped.dot(LUMINANCE_WEIGHTS);
    const desaturated = mix(vec3(luminance), toneMapped, this.uSaturation);

    return renderOutput(desaturated, NoToneMapping);
  }

  render() {
    const toneMapping = this.renderer.toneMapping;
    const outputColorSpace = this.renderer.outputColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.outputColorSpace = ColorManagement.workingColorSpace;
    try {
      this.mainSceneFrame.renderer = this.renderer;
      this.mainScenePass.updateBefore(this.mainSceneFrame);
      this.sceneManager.renderCamera.getWorldPosition(this.cameraWorldPosition);
      this.shadowPageRequests.run(
        this.sceneManager.renderCamera,
        lightingManager.sunDirection,
        shadowCasterRegistry.fixedVersion +
          shadowCasterRegistry.fixedRevision +
          shadowCasterRegistry.movingVersion +
          shadowCasterRegistry.deformedVersion +
          shadowCasterRegistry.movingRevision,
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
      this.shadowResidency.run(lightingManager.sunDirection);
      this.shadowFixedAtlas.render();
      this.shadowMovingAtlas.render();
    } finally {
      this.renderer.toneMapping = toneMapping;
      this.renderer.outputColorSpace = outputColorSpace;
    }
    super.render();
  }
}
