import {
  ACESFilmicToneMapping,
  ColorManagement,
  Matrix4,
  NoToneMapping,
  Vector3,
} from "three";
import {
  NodeFrame,
  RenderPipeline,
  RGBFormat,
  UnsignedInt101111Type,
  WebGPURenderer,
  type Node,
} from "three/webgpu";
import {
  float,
  Fn,
  getViewPosition,
  If,
  int,
  max,
  mix,
  mrt,
  output,
  pass,
  renderOutput,
  screenUV,
  smoothstep,
  step,
  texture,
  textureLevel,
  toneMapping,
  toneMappingExposure,
  uniform,
  uint,
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
import { playerUniforms } from "../../entities/Player/PlayerMaterial";
import { TSLUtils } from "../../utils/TSLUtils";
import { isShadowBaseline, isPagedV2 } from "../ShadowManager/config";
import { getGpuShadowPageAddress } from "../ShadowManager/ShadowPageCoordinates";
import { ShadowPageRequests } from "../ShadowManager/ShadowPageRequests";
import { ShadowResidency } from "../ShadowManager/ShadowResidency";
import {
  ShadowRigidAtlas,
  SHADOW_RIGID_PAGE_TEXELS,
} from "../ShadowManager/ShadowRigidAtlas";
import { ShadowVegetationAtlas } from "../ShadowManager/ShadowVegetationAtlas";

const MAIN_SCENE_PASS_SAMPLES = 4;
const LUMINANCE_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);
const BALL_SHADOW_PENUMBRA = 0.08;
const BALL_DEPTH_MATCH_EPSILON = 0.05;

export class PostprocessingManager extends RenderPipeline {
  private mainScenePass: ReturnType<typeof pass>;
  private waterPass: ReturnType<typeof pass>;
  private mainSceneFrame = new NodeFrame();
  private cameraWorldPosition = new Vector3();
  private shadowPageRequests?: ShadowPageRequests;
  private shadowResidency?: ShadowResidency;
  private shadowFixedAtlas?: ShadowRigidAtlas;
  private shadowMovingAtlas?: ShadowRigidAtlas;
  private shadowVegetationAtlas?: ShadowVegetationAtlas;
  private uSaturation = uniform(1);
  private uSunVisibility = uniform(1);
  private uShadowIntensity = uniform(0.7);
  private uRigidShadowSoftness = uniform(0.5);
  private uProjectionMatrixInverse = uniform(new Matrix4());
  private uCameraWorldMatrix = uniform(new Matrix4());
  private uCameraPosition = uniform(new Vector3());
  private saturationTarget = 1;
  private saturationLerpSpeed = 14;
  private sceneManager: SceneManager;
  private eventsManager: EventsManager;
  private debugManager: DebugManager;
  private debugFolder: DebugFolder;
  private debugView = {
    target: "scene",
  };
  private sceneOutputNode?: ReturnType<typeof renderOutput>;
  private directSunOutputNode?: ReturnType<typeof renderOutput>;
  private pageOutputNode?: ReturnType<typeof renderOutput>;
  private fixedDepthOutputNode?: ReturnType<typeof renderOutput>;
  private movingDepthOutputNode?: ReturnType<typeof renderOutput>;
  private fixedShadowOutputNode?: ReturnType<typeof renderOutput>;
  private movingShadowOutputNode?: ReturnType<typeof renderOutput>;
  private vegetationShadowOutputNode?: ReturnType<typeof renderOutput>;

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
    if (isPagedV2) {
      this.mainScenePass.setMRT(mrt({ output, directSun: vec4(0) }));
      const directSunTexture = this.mainScenePass.getTexture("directSun");
      directSunTexture.format = RGBFormat;
      directSunTexture.type = UnsignedInt101111Type;
    }
    this.waterPass = pass(
      this.sceneManager.waterScene,
      this.sceneManager.renderCamera,
      { samples: 0, depthBuffer: false },
    );
    this.mainScenePass.name = "Main scene";
    this.waterPass.name = "Water";
    const mainScenePassDepth = this.mainScenePass.renderTarget.depthTexture;
    if (mainScenePassDepth)
      mainScenePassDepth.renderTarget = this.mainScenePass.renderTarget;

    this.syncCameraUniforms();

    if (isPagedV2) {
      const depthTexture = this.mainScenePass.renderTarget.depthTexture;
      if (!depthTexture)
        throw new Error("V2 page requests require scene depth");
      this.shadowPageRequests = new ShadowPageRequests(
        renderer,
        depthTexture,
        this.uProjectionMatrixInverse,
        this.uCameraWorldMatrix,
        lightingManager.uSunDir,
      );
      this.shadowResidency = new ShadowResidency(
        renderer,
        this.shadowPageRequests,
      );
      const fixedAtlas = new ShadowRigidAtlas(
        renderer,
        this.shadowResidency,
        lightingManager.uSunDir,
        this.uRigidShadowSoftness,
        "fixed",
      );
      const movingAtlas = new ShadowRigidAtlas(
        renderer,
        this.shadowResidency,
        lightingManager.uSunDir,
        this.uRigidShadowSoftness,
        "moving",
      );
      this.shadowFixedAtlas = fixedAtlas;
      this.shadowMovingAtlas = movingAtlas;
      this.shadowVegetationAtlas = new ShadowVegetationAtlas(
        renderer,
        lightingManager.uSunDir,
      );
      monitoringManager.setShadowPageStats(this.shadowResidency.stats);
    }

    this.sceneOutputNode = this.makeGraph();
    if (isPagedV2)
      this.debugFolder.addBinding(this.uSunVisibility, "value", {
        label: "Sun visibility",
        min: 0,
        max: 1,
        step: 0.05,
      });
    if (isPagedV2)
      this.debugFolder.addBinding(this.uShadowIntensity, "value", {
        label: "Shadow intensity",
        min: 0,
        max: 1,
        step: 0.05,
      });
    if (this.shadowVegetationAtlas)
      this.debugFolder.addBinding(
        this.shadowVegetationAtlas.softness,
        "value",
        {
          label: "Grass shadow softness",
          min: 0,
          max: 2,
          step: 0.1,
        },
      );
    if (isPagedV2)
      this.debugFolder.addBinding(this.uRigidShadowSoftness, "value", {
        label: "Rigid shadow softness",
        min: 0.25,
        max: 1.5,
        step: 0.05,
      });
    if (isPagedV2) {
      if (!this.shadowFixedAtlas || !this.shadowMovingAtlas)
        throw new Error("V2 rigid shadow atlases are required");
      this.directSunOutputNode = renderOutput(
        vec4(this.getMainSceneTextureNode("directSun").sample(screenUV).rgb, 1),
        NoToneMapping,
      );
      this.pageOutputNode = this.makePageOutput();
      this.fixedDepthOutputNode = this.makeRigidDepthOutput(
        this.shadowFixedAtlas,
      );
      this.movingDepthOutputNode = this.makeRigidDepthOutput(
        this.shadowMovingAtlas,
      );
      this.fixedShadowOutputNode = this.makeRigidShadowOutput(
        this.shadowFixedAtlas,
      );
      this.movingShadowOutputNode = this.makeRigidShadowOutput(
        this.shadowMovingAtlas,
      );
      this.vegetationShadowOutputNode = this.makeVegetationShadowOutput();
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
            "Vegetation shadow": "vegetationShadow",
          },
        })
        .on("change", this.selectDebugView);
    }
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

  private syncCameraUniforms() {
    const camera = this.sceneManager.renderCamera;
    this.uProjectionMatrixInverse.value = camera.projectionMatrixInverse;
    this.uCameraWorldMatrix.value = camera.matrixWorld;
    this.uCameraPosition.value = camera.position;
  }

  private selectDebugView = () => {
    const selected =
      this.debugView.target === "directSun"
        ? this.directSunOutputNode
        : this.debugView.target === "pages"
          ? this.pageOutputNode
          : this.debugView.target === "fixedDepth"
            ? this.fixedDepthOutputNode
            : this.debugView.target === "movingDepth"
              ? this.movingDepthOutputNode
              : this.debugView.target === "fixedShadow"
                ? this.fixedShadowOutputNode
                : this.debugView.target === "movingShadow"
                  ? this.movingShadowOutputNode
                  : this.debugView.target === "vegetationShadow"
                    ? this.vegetationShadowOutputNode
                    : this.sceneOutputNode;
    if (!selected) return;
    this.outputNode = selected;
    this.needsUpdate = true;
  };

  private makePageOutput() {
    if (!this.shadowResidency) throw new Error("V2 residency is required");
    const depth = this.getMainSceneTextureNode("depth").sample(screenUV).r;
    const viewPosition = getViewPosition(
      screenUV,
      depth,
      this.uProjectionMatrixInverse,
    );
    const worldPosition = this.uCameraWorldMatrix.mul(
      vec4(viewPosition, 1),
    ).xyz;
    const level = viewPosition.z.negate().lessThan(21).select(uint(0), uint(1));
    const address = getGpuShadowPageAddress(
      worldPosition,
      lightingManager.uSunDir,
      level,
    );
    const { isResident } = this.shadowResidency.resolvePage(address.pageKey);
    const pageColor = vec3(
      address.pageId.x.mul(0.173).fract().mul(0.6).add(0.3),
      address.pageId.y.mul(0.127).fract().mul(0.6).add(0.3),
      level.equal(uint(0)).select(float(0.85), float(0.4)),
    );
    const edgeDistance = address.pageUv.x
      .min(float(1).sub(address.pageUv.x))
      .min(address.pageUv.y)
      .min(float(1).sub(address.pageUv.y));
    const pageCoverage = isResident.select(
      mix(pageColor, vec3(1), step(edgeDistance, 0.025).mul(0.7)),
      vec3(1, 0, 0),
    );
    const color = depth
      .greaterThanEqual(1)
      .select(
        vec3(0),
        address.isInsideGrid.select(pageCoverage, vec3(1, 0, 1)),
      );
    return renderOutput(vec4(color, 1), NoToneMapping);
  }

  private makeRigidDepthOutput(atlas: ShadowRigidAtlas) {
    if (!this.shadowResidency) throw new Error("V2 depth requires residency");
    const depth = this.getMainSceneTextureNode("depth").sample(screenUV).r;
    const viewPosition = getViewPosition(
      screenUV,
      depth,
      this.uProjectionMatrixInverse,
    );
    const worldPosition = this.uCameraWorldMatrix.mul(
      vec4(viewPosition, 1),
    ).xyz;
    const level = viewPosition.z.negate().lessThan(21).select(uint(0), uint(1));
    const address = getGpuShadowPageAddress(
      worldPosition,
      lightingManager.uSunDir,
      level,
    );
    const { slot, isResident } = this.shadowResidency.resolvePage(
      address.pageKey,
    );
    const pageUv = address.pageUv.clamp(
      0.5 / SHADOW_RIGID_PAGE_TEXELS,
      1 - 0.5 / SHADOW_RIGID_PAGE_TEXELS,
    );
    const atlasDepth = atlas.sampleDebugDepth(slot, pageUv);
    const visualDepth = atlasDepth.sub(0.65).mul(5).clamp();
    const color = depth
      .greaterThanEqual(1)
      .select(
        vec3(0),
        address.isInsideGrid
          .and(isResident)
          .select(vec3(visualDepth), vec3(1, 0, 0)),
      );
    return renderOutput(vec4(color, 1), NoToneMapping);
  }

  private makeRigidShadowOutput(atlas: ShadowRigidAtlas) {
    const depth = this.getMainSceneTextureNode("depth").sample(screenUV).r;
    const viewPosition = getViewPosition(
      screenUV,
      depth,
      this.uProjectionMatrixInverse,
    );
    const worldPosition = this.uCameraWorldMatrix.mul(
      vec4(viewPosition, 1),
    ).xyz;
    const visibility = atlas.computeVisibility(
      worldPosition,
      depth,
      viewPosition.z.negate(),
    );
    return renderOutput(vec4(vec3(visibility), 1), NoToneMapping);
  }

  private makeVegetationShadowOutput() {
    if (!this.shadowVegetationAtlas)
      throw new Error("V2 vegetation shadow atlas is required");
    const depth = this.getMainSceneTextureNode("depth").sample(screenUV).r;
    const viewPosition = getViewPosition(
      screenUV,
      depth,
      this.uProjectionMatrixInverse,
    );
    const worldPosition = this.uCameraWorldMatrix.mul(
      vec4(viewPosition, 1),
    ).xyz;
    const visibility = this.shadowVegetationAtlas.sampleVisibility(
      worldPosition,
      depth,
    );
    return renderOutput(vec4(vec3(visibility), 1), NoToneMapping);
  }

  private computeBallShadowFactor = Fn(() => {
    const radius = playerUniforms.uRadius;
    const radiusSq = radius.mul(radius);
    const sunDir = lightingManager.uSunDir;

    const depth = this.mainScenePass.getTextureNode("depth").sample(screenUV).r;
    const viewPosition = getViewPosition(
      screenUV,
      depth,
      this.uProjectionMatrixInverse,
    );
    const worldPosition = this.uCameraWorldMatrix.mul(
      vec4(viewPosition, 1),
    ).xyz;

    const pixelToBall = playerUniforms.uPosition.sub(worldPosition);
    const ballAlongSun = pixelToBall.dot(sunDir).negate();
    const sunRayOffsetSq = pixelToBall
      .dot(pixelToBall)
      .sub(ballAlongSun.mul(ballAlongSun));
    const penumbra = radius.add(BALL_SHADOW_PENUMBRA);
    const occlusion = smoothstep(
      radiusSq,
      penumbra.mul(penumbra),
      sunRayOffsetSq,
    );
    const isBallBehindPixel = step(ballAlongSun, 0);

    const isSky = step(1, depth);

    const cameraToBall = playerUniforms.uPosition.sub(this.uCameraPosition);
    const cameraToPixel = worldPosition.sub(this.uCameraPosition);
    const pixelDistance = cameraToPixel.length();
    const viewRay = cameraToPixel.div(pixelDistance);
    const ballAlongView = cameraToBall.dot(viewRay);
    const viewRayOffsetSq = cameraToBall
      .dot(cameraToBall)
      .sub(ballAlongView.mul(ballAlongView));
    const halfChord = max(radiusSq.sub(viewRayOffsetSq), 0).sqrt();
    const ballNearHit = ballAlongView.sub(halfChord);
    const isBallSurface = step(viewRayOffsetSq, radiusSq).mul(
      float(1).sub(
        step(BALL_DEPTH_MATCH_EPSILON, ballNearHit.sub(pixelDistance).abs()),
      ),
    );

    const ballShadow = occlusion
      .max(isBallBehindPixel)
      .max(isSky)
      .max(isBallSurface)
      .clamp()
      .toVar();

    If(ballShadow.lessThan(1), () => {
      const bakedLit = textureLevel(
        assetManager.resources.terrainMaps,
        TSLUtils.computeMapUvByPosition(worldPosition.xz),
        int(0),
      ).r;
      ballShadow.assign(mix(float(1), ballShadow, bakedLit));
    });

    return ballShadow;
  });

  sampleMainSceneColor(uv: Node<"vec2">) {
    const sceneColor = this.getMainSceneTextureNode().sample(uv);
    if (!isPagedV2) return sceneColor;
    if (
      !this.shadowFixedAtlas ||
      !this.shadowMovingAtlas ||
      !this.shadowVegetationAtlas
    )
      throw new Error("V2 shadow atlases are required");

    const depth = this.getMainSceneTextureNode("depth").sample(uv).r;
    const viewPosition = getViewPosition(
      uv,
      depth,
      this.uProjectionMatrixInverse,
    );
    const worldPosition = this.uCameraWorldMatrix.mul(
      vec4(viewPosition, 1),
    ).xyz;
    const visibility = this.shadowFixedAtlas
      .computeVisibility(
        worldPosition,
        depth,
        viewPosition.z.negate(),
        this.shadowMovingAtlas,
      )
      .mul(this.shadowVegetationAtlas.sampleVisibility(worldPosition, depth));
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

  get mainSceneDepthNode() {
    return this.getMainSceneTextureNode("depth");
  }

  private getMainSceneTextureNode(name = "output") {
    if (!isPagedV2) return this.mainScenePass.getTextureNode(name);
    if (name === "depth") {
      const depthTexture = this.mainScenePass.renderTarget.depthTexture;
      if (!depthTexture) throw new Error("V2 scene depth is required");
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

    const withBloomHDR = colorHDR.add(bloomPass);
    const shadowedHDR =
      isShadowBaseline || isPagedV2
        ? withBloomHDR
        : mix(
            withBloomHDR.mul(lightingManager.uPlayerShadowBrightness),
            withBloomHDR,
            this.computeBallShadowFactor(),
          );

    const toneMapped = toneMapping(
      ACESFilmicToneMapping,
      toneMappingExposure,
      shadowedHDR,
    ).rgb;
    const luminance = toneMapped.dot(LUMINANCE_WEIGHTS);
    const desaturated = mix(vec3(luminance), toneMapped, this.uSaturation);

    return renderOutput(desaturated, NoToneMapping);
  }

  render() {
    if (!isPagedV2) {
      super.render();
      return;
    }

    const toneMapping = this.renderer.toneMapping;
    const outputColorSpace = this.renderer.outputColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.outputColorSpace = ColorManagement.workingColorSpace;
    try {
      this.mainSceneFrame.renderer = this.renderer;
      this.mainScenePass.updateBefore(this.mainSceneFrame);
      this.shadowPageRequests?.run(
        this.sceneManager.renderCamera,
        lightingManager.sunDirection,
        shadowCasterRegistry.fixedVersion +
          shadowCasterRegistry.fixedRevision +
          shadowCasterRegistry.movingVersion +
          shadowCasterRegistry.deformedVersion +
          shadowCasterRegistry.movingRevision,
      );
      this.sceneManager.renderCamera.getWorldPosition(this.cameraWorldPosition);
      const { min, max } = assetManager.resources.heightmap.userData;
      if (typeof min !== "number" || typeof max !== "number")
        throw new Error("V2 fixed depth requires terrain height bounds");
      this.shadowFixedAtlas?.syncCasters(
        shadowCasterRegistry,
        lightingManager.sunDirection,
        { min, max },
      );
      this.shadowMovingAtlas?.syncCasters(
        shadowCasterRegistry,
        lightingManager.sunDirection,
        { min, max },
      );
      this.shadowVegetationAtlas?.syncCasters(shadowCasterRegistry, {
        min,
        max,
      });
      this.shadowResidency?.run(
        this.cameraWorldPosition,
        lightingManager.sunDirection,
      );
      this.shadowFixedAtlas?.render();
      this.shadowMovingAtlas?.render();
      this.shadowVegetationAtlas?.render(
        playerUniforms.uPosition.value,
        lightingManager.sunDirection,
        { min, max },
      );
    } finally {
      this.renderer.toneMapping = toneMapping;
      this.renderer.outputColorSpace = outputColorSpace;
    }
    super.render();
  }
}
