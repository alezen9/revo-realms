import {
  ACESFilmicToneMapping,
  Box3,
  ColorManagement,
  MathUtils,
  Matrix4,
  Mesh,
  NoToneMapping,
  Vector3,
} from "three";
import {
  NodeFrame,
  type Node,
  RenderPipeline,
  RGBFormat,
  UnsignedInt101111Type,
  WebGPURenderer,
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
  select,
  smoothstep,
  step,
  texture,
  textureLevel,
  toneMapping,
  toneMappingExposure,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import type { DebugFolder, DebugManager } from "../DebugManager";
import type { EventsManager } from "../EventsManager";
import type { SceneManager } from "../SceneManager";
import { assetManager, lightingManager } from "..";
import { playerUniforms } from "../../entities/Player/PlayerMaterial";
import { TSLUtils } from "../../utils/TSLUtils";
import { shadowConfig } from "../ShadowManager/config";
import type { ShadowDebugView } from "../ShadowManager/config";
import {
  computeGpuShadowPageAddress,
  ShadowPageCoordinates,
} from "../ShadowManager/ShadowPageCoordinates";
import { ShadowSchedulingProof } from "../ShadowManager/ShadowSchedulingProof";
import { ShadowPageRequests } from "../ShadowManager/ShadowPageRequests";
import { ShadowResidency } from "../ShadowManager/ShadowResidency";
import { ShadowAtlas } from "../ShadowManager/ShadowAtlas";
import { updateStaticShadowResidencyTelemetry } from "../ShadowManager/telemetry";
import {
  DYNAMIC_SHADOW_PAGE_CAPACITY,
  DynamicShadowPages,
} from "../ShadowManager/DynamicShadowPages";

const MAIN_SCENE_PASS_SAMPLES = 4;
const LUMINANCE_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);
const BALL_SHADOW_PENUMBRA = 0.08;
const BALL_DEPTH_MATCH_EPSILON = 0.05;
const STATIC_SHADOW_PAGE_TEXEL_SIZE = 256;
const STATIC_SHADOW_CASTER_NAMES = [
  "goku_statue",
  "leviathan_axe",
  "dragon_slayer",
  "campfire",
] as const;
type ColorNode = Node<"vec4">;
type Color3Node = Node<"vec3">;

const SHADOW_DEBUG_VIEW_INDEX: Record<ShadowDebugView, number> = {
  final: 0,
  mainDepth: 1,
  pageIds: 2,
  pageEdges: 3,
  shadowDepth: 4,
  range: 5,
};

export class PostprocessingManager extends RenderPipeline {
  private mainScenePass: ReturnType<typeof pass>;
  private waterPass: ReturnType<typeof pass>;
  private schedulingProof?: ShadowSchedulingProof;
  private shadowPageRequests?: ShadowPageRequests;
  private shadowResidency?: ShadowResidency;
  private shadowAtlas?: ShadowAtlas;
  private dynamicShadowPages?: DynamicShadowPages;
  private staticShadowResidency?: ShadowResidency;
  private staticShadowAtlas?: ShadowAtlas;
  private staticShadowCasters: Mesh[] = [];
  private staticShadowCasterMatrices: Matrix4[] = [];
  private staticShadowSunDirection = new Vector3();
  private schedulingProofPass?: ReturnType<typeof pass>;
  private mainSceneFrame = new NodeFrame();
  private shadowPageCoordinates = new ShadowPageCoordinates();
  private initialSceneBounds = new Box3();
  private hasRegisteredInitialSceneBounds = false;
  private uShadowDebugView = uniform(
    SHADOW_DEBUG_VIEW_INDEX[shadowConfig.initialDebugView],
  );
  private shadowDebugState = {
    view: shadowConfig.initialDebugView,
    cameraPageX: 0,
    cameraPageY: 0,
    minimumWorldY: 0,
    maximumWorldY: 0,
    sunElevationDegrees: 0,
    rayDepthSpan: 0,
    isDynamicCasterEnabled: true,
  };
  private uSaturation = uniform(1);
  private uProjectionMatrixInverse = uniform(new Matrix4());
  private uCameraWorldMatrix = uniform(new Matrix4());
  private uCameraPosition = uniform(new Vector3());
  private uPagedShadowVisibility = uniform(shadowConfig.initialVisibility);
  private saturationTarget = 1;
  private saturationLerpSpeed = 14;
  private sceneManager: SceneManager;
  private eventsManager: EventsManager;
  private debugManager: DebugManager;
  private debugFolder: DebugFolder;
  private webgpuRenderer: WebGPURenderer;

  constructor(
    renderer: WebGPURenderer,
    sceneManager: SceneManager,
    eventsManager: EventsManager,
    debugManager: DebugManager,
  ) {
    super(renderer);
    this.webgpuRenderer = renderer;
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
    if (shadowConfig.isPagedEnabled) {
      this.setupDirectSunTarget();
      this.setupSchedulingProof();
      if (shadowConfig.arePageRequestsEnabled) this.setupShadowPageRequests();
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

    if (shadowConfig.isPagedEnabled) {
      this.debugFolder.addBinding(this.uPagedShadowVisibility, "value", {
        label: "Paged shadow visibility",
        min: 0,
        max: 1,
        step: 0.01,
      });
      this.setupShadowDebugBindings();
    }

    this.syncCameraUniforms();

    const passes = this.makeGraph();
    this.outputNode = passes;

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

  private setupDirectSunTarget() {
    const directSunMrt = mrt({
      output,
      directSun: vec4(0),
    });
    this.mainScenePass.setMRT(directSunMrt);

    const directSunTexture = this.mainScenePass.getTexture("directSun");
    directSunTexture.format = RGBFormat;
    directSunTexture.type = UnsignedInt101111Type;
  }

  private setupSchedulingProof() {
    const depthTexture = this.mainScenePass.renderTarget.depthTexture;
    if (!depthTexture) throw new Error("Main scene depth texture is required");
    this.mainScenePass.renderTarget.samples = MAIN_SCENE_PASS_SAMPLES;
    this.schedulingProof = new ShadowSchedulingProof(
      this.webgpuRenderer,
      depthTexture,
    );
    this.schedulingProofPass = pass(
      this.schedulingProof.scene,
      this.schedulingProof.camera,
      { samples: 0 },
    );
    this.schedulingProofPass.name = "Shadow scheduling proof";
    this.schedulingProofPass.setResolutionScale(1 / 64);
  }

  private setupShadowPageRequests() {
    const depthTexture = this.mainScenePass.renderTarget.depthTexture;
    if (!depthTexture) throw new Error("Main scene depth texture is required");
    this.shadowPageRequests = new ShadowPageRequests({
      renderer: this.webgpuRenderer,
      depthTexture,
      projectionMatrixInverse: this.uProjectionMatrixInverse,
      cameraWorldMatrix: this.uCameraWorldMatrix,
      sunDirectionNode: lightingManager.uSunDir,
      sunDirection: lightingManager.sunDirection,
      coordinates: this.shadowPageCoordinates,
    });
    this.dynamicShadowPages = new DynamicShadowPages(
      this.shadowPageCoordinates,
    );
    this.shadowResidency = new ShadowResidency(
      this.webgpuRenderer,
      this.dynamicShadowPages.requestListAttribute,
      this.dynamicShadowPages.counterAttribute,
      { capacity: DYNAMIC_SHADOW_PAGE_CAPACITY },
    );
    this.shadowAtlas = new ShadowAtlas({
      renderer: this.webgpuRenderer,
      residency: this.shadowResidency,
      coordinates: this.shadowPageCoordinates,
      sunDirection: lightingManager.uSunDir,
      name: "Dynamic paged shadow atlas",
    });
    this.staticShadowResidency = new ShadowResidency(
      this.webgpuRenderer,
      this.shadowPageRequests.requestListAttribute,
      this.shadowPageRequests.counterAttribute,
      {
        refreshMode: "onInvalidation",
        onTelemetry: updateStaticShadowResidencyTelemetry,
      },
    );
    this.staticShadowAtlas = new ShadowAtlas({
      renderer: this.webgpuRenderer,
      residency: this.staticShadowResidency,
      coordinates: this.shadowPageCoordinates,
      sunDirection: lightingManager.uSunDir,
      pageTexelSize: STATIC_SHADOW_PAGE_TEXEL_SIZE,
      name: "Static paged shadow atlas",
    });
  }

  private setupShadowDebugBindings() {
    this.debugFolder
      .addBinding(this.shadowDebugState, "view", {
        label: "Shadow debug view",
        options: {
          Final: "final",
          "Main depth": "mainDepth",
          "Page IDs": "pageIds",
          "Page edges": "pageEdges",
          "Shadow visibility": "shadowDepth",
          Range: "range",
        },
      })
      .on("change", ({ value }) => {
        this.uShadowDebugView.value = SHADOW_DEBUG_VIEW_INDEX[value];
      });
    this.debugFolder.addBinding(this.shadowDebugState, "cameraPageX", {
      label: "Camera page X",
      readonly: true,
    });
    this.debugFolder.addBinding(this.shadowDebugState, "cameraPageY", {
      label: "Camera page Y",
      readonly: true,
    });
    this.debugFolder.addBinding(this.shadowDebugState, "minimumWorldY", {
      label: "Minimum world Y",
      readonly: true,
    });
    this.debugFolder.addBinding(this.shadowDebugState, "maximumWorldY", {
      label: "Maximum world Y",
      readonly: true,
    });
    this.debugFolder.addBinding(this.shadowDebugState, "sunElevationDegrees", {
      label: "Sun elevation",
      readonly: true,
    });
    this.debugFolder.addBinding(this.shadowDebugState, "rayDepthSpan", {
      label: "Ray depth span",
      readonly: true,
    });
    this.debugFolder.addBinding(
      this.shadowDebugState,
      "isDynamicCasterEnabled",
      { label: "Dynamic player caster" },
    );
  }

  private getMainSceneTextureNode(name = "output") {
    if (!shadowConfig.isPagedEnabled)
      return this.mainScenePass.getTextureNode(name);

    if (name === "depth") {
      const depthTexture = this.mainScenePass.renderTarget.depthTexture;
      if (!depthTexture) throw new Error("Main scene depth texture is required");
      return texture(depthTexture);
    }

    return texture(this.mainScenePass.getTexture(name));
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

  get mainSceneColorNode() {
    return this.getMainSceneTextureNode();
  }

  get mainSceneDepthNode() {
    return this.getMainSceneTextureNode("depth");
  }

  private resolvePagedShadow(mainSceneColor: ColorNode) {
    const directSun = this.getMainSceneTextureNode("directSun").sample(
      screenUV,
    ).rgb;
    const depth = this.getMainSceneTextureNode("depth").sample(screenUV).r;
    const viewPosition = getViewPosition(
      screenUV,
      depth,
      this.uProjectionMatrixInverse,
    );
    const worldPosition = this.uCameraWorldMatrix.mul(
      vec4(viewPosition, 1),
    ).xyz;
    const viewDepth = viewPosition.z.negate();
    const fogTransmittance = lightingManager.uFogDensity
      .mul(lightingManager.uFogDensity, viewDepth, viewDepth)
      .negate()
      .exp();
    const dynamicVisibility = this.shadowAtlas
      ? this.shadowAtlas.computeVisibility(worldPosition, depth)
      : float(1);
    const staticVisibility = this.staticShadowAtlas
      ? this.staticShadowAtlas.computeVisibility(worldPosition, depth)
      : float(1);
    const visibility = dynamicVisibility.min(staticVisibility);
    const removedDirectSun = directSun
      .mul(fogTransmittance)
      .mul(visibility.oneMinus())
      .mul(this.uPagedShadowVisibility);

    return {
      color: vec4(mainSceneColor.rgb.sub(removedDirectSun), mainSceneColor.a),
      visibility,
    };
  }

  private applyShadowDebug(
    finalColor: Color3Node,
    shadowVisibility: Node<"float">,
  ) {
    const depth = this.getMainSceneTextureNode("depth").sample(screenUV).r;
    const viewPosition = getViewPosition(
      screenUV,
      depth,
      this.uProjectionMatrixInverse,
    );
    const worldPosition = this.uCameraWorldMatrix.mul(
      vec4(viewPosition, 1),
    ).xyz;
    const address = computeGpuShadowPageAddress({
      worldPosition,
      sunDirection: lightingManager.uSunDir,
      minimumWorldY: this.shadowPageCoordinates.minimumWorldY,
      maximumWorldY: this.shadowPageCoordinates.maximumWorldY,
    });
    const pageHash = address.pageId
      .dot(vec2(12.9898, 78.233))
      .sin()
      .mul(43758.5453)
      .fract();
    const pageColor = vec3(
      pageHash,
      pageHash.add(0.37).fract(),
      pageHash.add(0.73).fract(),
    );
    const edgeDistance = address.pageUv.x
      .min(address.pageUv.y)
      .min(address.pageUv.x.oneMinus())
      .min(address.pageUv.y.oneMinus());
    const pageInterior = smoothstep(0, 0.025, edgeDistance);
    const isSky = step(1, depth);
    const viewDepth = viewPosition.z.negate();
    const depthPreview = viewDepth
      .mul(-0.02)
      .exp()
      .oneMinus()
      .mix(float(1), isSky);
    const visiblePageColor = select(
      address.isOutOfRange,
      vec3(1, 0, 1),
      pageColor,
    ).mul(isSky.oneMinus());
    const shadowDepth = vec3(shadowVisibility);
    const rangeColor = select(
      address.isOutOfRange,
      vec3(1, 0, 1),
      vec3(0.1, 0.8, 0.2),
    ).mul(isSky.oneMinus());
    const debugColor = select(
      this.uShadowDebugView.equal(1),
      vec3(depthPreview),
      select(
        this.uShadowDebugView.equal(2),
        visiblePageColor,
        select(
          this.uShadowDebugView.equal(3),
          visiblePageColor.mul(pageInterior),
          select(
            this.uShadowDebugView.equal(4),
            shadowDepth,
            select(this.uShadowDebugView.equal(5), rangeColor, finalColor),
          ),
        ),
      ),
    );

    if (!this.schedulingProofPass) return debugColor;

    const proofDepth = this.schedulingProofPass
      .getTextureNode("depth")
      .sample(screenUV).r;
    const hasProof = step(proofDepth, 0.999);
    return mix(vec3(1, 0, 1), debugColor, hasProof);
  }

  private makeGraph() {
    this.outputColorTransform = false;
    const mainSceneColor = this.getMainSceneTextureNode();
    const pagedShadow = shadowConfig.isPagedEnabled
      ? this.resolvePagedShadow(mainSceneColor)
      : undefined;
    const resolvedMainSceneColor = pagedShadow?.color ?? mainSceneColor;
    const water = this.waterPass.getTextureNode();
    const colorHDR = resolvedMainSceneColor
      .mul(water.a.oneMinus())
      .add(water.rgb);

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
    const shadowedHDR = shadowConfig.isPagedEnabled
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

    const finalColor = shadowConfig.isPagedEnabled
      ? this.applyShadowDebug(
          desaturated,
          pagedShadow?.visibility ?? float(1),
        )
      : desaturated;

    return renderOutput(finalColor, NoToneMapping);
  }

  private syncShadowPageDebugState() {
    this.shadowPageCoordinates.syncTerrainBounds(
      assetManager.resources.heightmap,
    );
    if (!this.hasRegisteredInitialSceneBounds) {
      this.initialSceneBounds.makeEmpty();
      this.sceneManager.mainScene.traverse((object) => {
        if (object instanceof Mesh)
          this.initialSceneBounds.expandByObject(object, true);
      });
      if (!this.initialSceneBounds.isEmpty()) {
        this.shadowPageCoordinates.registerCasterVerticalBounds(
          this.initialSceneBounds.min.y,
          this.initialSceneBounds.max.y,
        );
        this.hasRegisteredInitialSceneBounds = true;
      }
    }
    const cameraAddress = this.shadowPageCoordinates.computeAddress(
      this.sceneManager.renderCamera.position,
      lightingManager.sunDirection,
    );
    const absoluteSunY = Math.max(
      Math.abs(lightingManager.sunDirection.y),
      0.0001,
    );
    const minimumWorldY = this.shadowPageCoordinates.minimumWorldY.value;
    const maximumWorldY = this.shadowPageCoordinates.maximumWorldY.value;

    this.shadowDebugState.cameraPageX = cameraAddress.pageX;
    this.shadowDebugState.cameraPageY = cameraAddress.pageY;
    this.shadowDebugState.minimumWorldY = minimumWorldY;
    this.shadowDebugState.maximumWorldY = maximumWorldY;
    this.shadowDebugState.sunElevationDegrees =
      Math.asin(absoluteSunY) * MathUtils.RAD2DEG;
    this.shadowDebugState.rayDepthSpan =
      (maximumWorldY - minimumWorldY) / absoluteSunY;
  }

  private syncStaticShadowCasters() {
    const casters: Mesh[] = [];
    for (const name of STATIC_SHADOW_CASTER_NAMES) {
      const caster = this.sceneManager.mainScene.getObjectByName(name);
      if (!(caster instanceof Mesh)) return;
      caster.updateWorldMatrix(true, false);
      casters.push(caster);
    }

    if (this.staticShadowCasters.length === 0) {
      this.staticShadowCasters = casters;
      this.staticShadowCasterMatrices = [];
      for (const caster of casters)
        this.staticShadowCasterMatrices.push(caster.matrixWorld.clone());
      this.staticShadowAtlas?.updateStaticCasters(
        casters,
        lightingManager.sunDirection,
      );
      this.staticShadowSunDirection.copy(lightingManager.sunDirection);
      this.staticShadowResidency?.invalidate();
      return;
    }

    let hasCasterChanged = false;
    for (let index = 0; index < casters.length; index++) {
      if (
        this.staticShadowCasterMatrices[index].equals(
          casters[index].matrixWorld,
        )
      )
        continue;
      this.staticShadowCasterMatrices[index].copy(casters[index].matrixWorld);
      hasCasterChanged = true;
    }
    const hasSunChanged = !this.staticShadowSunDirection.equals(
      lightingManager.sunDirection,
    );
    if (!hasCasterChanged && !hasSunChanged) return;

    this.staticShadowAtlas?.updateStaticCasters(
      casters,
      lightingManager.sunDirection,
    );
    this.staticShadowSunDirection.copy(lightingManager.sunDirection);
    this.staticShadowResidency?.invalidate();
  }

  render() {
    if (!shadowConfig.isPagedEnabled) {
      super.render();
      return;
    }

    const toneMapping = this.renderer.toneMapping;
    const outputColorSpace = this.renderer.outputColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.outputColorSpace = ColorManagement.workingColorSpace;

    try {
      this.syncShadowPageDebugState();
      this.mainSceneFrame.renderer = this.renderer;
      this.mainScenePass.updateBefore(this.mainSceneFrame);
      const playerCaster = this.sceneManager.mainScene.getObjectByName("player");
      if (
        playerCaster instanceof Mesh &&
        this.shadowDebugState.isDynamicCasterEnabled
      ) {
        this.shadowAtlas?.attachCaster(playerCaster);
        this.dynamicShadowPages?.update(
          playerCaster,
          lightingManager.sunDirection,
        );
      } else {
        this.dynamicShadowPages?.update(undefined, lightingManager.sunDirection);
      }
      this.syncStaticShadowCasters();
      this.shadowPageRequests?.run();
      this.shadowResidency?.run();
      this.staticShadowResidency?.run();
      this.shadowAtlas?.render();
      this.staticShadowAtlas?.render();
      this.schedulingProof?.run();
      this.renderer.toneMapping = toneMapping;
      this.renderer.outputColorSpace = outputColorSpace;
      super.render();
    } finally {
      this.renderer.toneMapping = toneMapping;
      this.renderer.outputColorSpace = outputColorSpace;
    }
  }
}
