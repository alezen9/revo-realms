import {
  ColorManagement,
  NoToneMapping,
  Matrix4,
  OrthographicCamera,
  Vector3,
} from "three";
import { RenderPipeline, WebGPURenderer, type Node } from "three/webgpu";
import {
  float,
  getViewPosition,
  mix,
  mrt,
  pass,
  positionWorld,
  renderOutput,
  screenUV,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { State } from "../../Game";
import type { Lighting } from "../lighting/Lighting";
import type {
  DebugBinding,
  DebugFolder,
  DebugPanel,
} from "../debug/DebugPanel";
import type { EventBus } from "../events/EventBus";
import type { Stage } from "../scene/Stage";
import { VSMPass, type VSMDependencies } from "../vsm/VSMPass";
import { DualKawaseBloomPass } from "./passes/DualKawaseBloomPass";
import { PostChain } from "./PostChain";
import { ScenePass } from "./passes/ScenePass";
import { TexturePass } from "./passes/TexturePass";
import { ACESToneMappingPass } from "./passes/ACESToneMappingPass";
import { WaterPass } from "./passes/WaterPass";

const SUN_VIEW_DISTANCE = 3000;
const CAMERA_FOOTPRINT_COLOR = vec3(1, 0.85, 0.1);

const BLOOM_OPTIONS = {
  strength: 0.8,
  threshold: 1,
  smoothWidth: 0.04,
  spread: 2,
};

export class FramePipeline extends RenderPipeline {
  private scenePass: ScenePass;
  readonly vsmPass: VSMPass;
  private waterPass: WaterPass;
  private hdrPass: TexturePass;
  private dualKawaseBloomPass: DualKawaseBloomPass;
  private acesToneMappingPass: ACESToneMappingPass;
  private chain: PostChain<ReturnType<typeof renderOutput>>;
  private saturationTarget = 1;
  private saturationLerpSpeed = 14;
  private stage: Stage;
  private eventBus: EventBus;
  private debugPanel: DebugPanel;
  private debugFolder: DebugFolder;
  private debugView = {
    target: "Scene",
  };
  private debugOutputs: Record<string, ReturnType<typeof renderOutput>>;
  private debugLegends: Record<string, string>;
  private debugLegend = { text: "" };
  private debugLegendBinding: DebugBinding<string>;
  private lighting: Lighting;
  private sunView = { halfSize: 60 };
  private sunViewCamera = new OrthographicCamera(
    -1,
    1,
    1,
    -1,
    1,
    SUN_VIEW_DISTANCE * 2,
  );
  private uSunViewFocus = uniform(new Vector3());
  private uSunViewRange = uniform(190);
  private uDepthViewRange = uniform(150);
  private uSunViewProjection = uniform(new Matrix4());
  private uSunViewProjectionInverse = uniform(new Matrix4());
  private uSunViewCameraWorld = uniform(new Matrix4());
  private uMainViewProjection = uniform(new Matrix4());
  private uMainCameraPosition = uniform(new Vector3());

  constructor(
    renderer: WebGPURenderer,
    stage: Stage,
    eventBus: EventBus,
    debugPanel: DebugPanel,
    vsmDependencies: VSMDependencies,
  ) {
    super(renderer);
    renderer.toneMappingExposure = 2;
    this.outputColorTransform = false;
    this.stage = stage;
    this.eventBus = eventBus;
    this.debugPanel = debugPanel;
    this.lighting = vsmDependencies.lighting;

    this.debugFolder = this.debugPanel.panel.addFolder({
      title: "⭐️ Postprocessing",
      expanded: false,
    });

    const camera = this.stage.renderCamera;
    this.scenePass = new ScenePass(renderer, stage.mainScene, camera);
    this.vsmPass = new VSMPass(
      renderer,
      this.scenePass,
      camera,
      vsmDependencies,
    );
    this.waterPass = new WaterPass(renderer, stage.waterScene, camera);
    this.hdrPass = new TexturePass(renderer, "Scene HDR");
    this.dualKawaseBloomPass = new DualKawaseBloomPass(renderer, BLOOM_OPTIONS);
    this.acesToneMappingPass = new ACESToneMappingPass();

    this.chain = PostChain.from(this.scenePass)
      .pipe(this.vsmPass)
      .pipe(this.waterPass)
      .pipe(this.vsmPass.volumetricLight)
      .pipe(this.hdrPass)
      .pipe(this.dualKawaseBloomPass)
      .pipe(this.acesToneMappingPass);

    const sunViewDepth = positionWorld
      .sub(this.uSunViewFocus)
      .dot(this.lighting.uSunDir)
      .div(this.uSunViewRange.mul(2))
      .add(0.5)
      .clamp();
    const sunViewPass = pass(stage.mainScene, this.sunViewCamera);
    sunViewPass.setMRT(mrt({ output: vec4(vec3(sunViewDepth), 1) }));
    const sunView = sunViewPass.getTextureNode("output");
    const isSky = this.scenePass.depth.sample(screenUV).r.greaterThanEqual(1);
    const receiverWorld = this.vsmPass.getWorldPosition(screenUV);
    const receiverSunDepth = receiverWorld
      .sub(this.uSunViewFocus)
      .dot(this.lighting.uSunDir)
      .div(this.uSunViewRange.mul(2))
      .add(0.5)
      .clamp();
    const receiverSunClip = this.uSunViewProjection.mul(vec4(receiverWorld, 1));
    const receiverSunUv = vec2(
      receiverSunClip.x.mul(0.5).add(0.5),
      receiverSunClip.y.mul(-0.5).add(0.5),
    );
    const isInsideSunView = receiverSunUv
      .greaterThanEqual(vec2(0))
      .all()
      .and(receiverSunUv.lessThanEqual(vec2(1)).all());
    const storedSunView = sunView.sample(receiverSunUv);
    const storedSunDepth = mix(
      vec3(1),
      storedSunView.rgb,
      storedSunView.a.mul(isInsideSunView.toFloat()),
    );
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
    const requestedPages = this.vsmPass.getRequestedPageColor(sunSurfaceWorld);
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
    const mainSurfaceWorld = this.vsmPass.getWorldPosition(mainUv);
    const cameraDistance = sunSurfaceWorld.distance(this.uMainCameraPosition);
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
    const sunLevelGrid = this.vsmPass.getLevelGridColor(
      sunSurfaceWorld,
      this.uSunViewFocus,
    );
    const sunViewWithLevels = mix(
      sunViewBase,
      sunLevelGrid.color,
      sunLevelGrid.coverage.mul(sunView.a).mul(0.6),
    );
    const sceneLevelGrid = this.vsmPass.getLevelGridColor(
      this.vsmPass.getWorldPosition(screenUV),
      this.uSunViewFocus,
    );
    const sceneLevelCoverage = sceneLevelGrid.coverage
      .mul(float(1).sub(float(isSky)))
      .mul(0.55);
    const sceneWithLevels = mix(
      this.chain.output.rgb.pow(2.2),
      sceneLevelGrid.color,
      sceneLevelCoverage,
    );
    const sceneDistance = this.vsmPass
      .getWorldPosition(screenUV)
      .distance(this.uMainCameraPosition);
    this.debugOutputs = {
      Scene: this.chain.output,
      "Direct sun": renderOutput(
        vec4(this.scenePass.directSun.sample(screenUV).rgb, 1),
        NoToneMapping,
      ),
      "Shadow softness": renderOutput(
        vec4(vec3(this.scenePass.softShadow.sample(screenUV).r), 1),
        NoToneMapping,
      ),
      Depth: renderOutput(
        vec4(vec3(sceneDistance.div(this.uDepthViewRange).clamp(0, 1)), 1),
        NoToneMapping,
      ),
      Levels: renderOutput(vec4(sceneWithLevels, 1), NoToneMapping),
      "Levels (sun view)": renderOutput(
        vec4(sunViewWithLevels, 1),
        NoToneMapping,
      ),
      ...this.vsmPass.createDebugOutputs(),
      "Sun view": renderOutput(
        vec4(mix(vec3(1), sunView.rgb, sunView.a), 1),
        NoToneMapping,
      ),
      "Sun view pages": renderOutput(
        vec4(sunViewWithFootprint, 1),
        NoToneMapping,
      ),
      "Sun depth (receiver)": renderOutput(
        vec4(mix(vec3(receiverSunDepth), vec3(1), isSky.toFloat()), 1),
        NoToneMapping,
      ),
      "Sun depth (stored)": renderOutput(
        vec4(mix(storedSunDepth, vec3(1), isSky.toFloat()), 1),
        NoToneMapping,
      ),
    };
    this.debugLegends = this.vsmPass.createDebugLegends();
    this.debugLegendBinding = this.addBindings();
    this.selectDebugView();

    this.eventBus.on("engine-camera-change", this.onCameraChange);
    this.eventBus.on("engine-slowmo-change", this.onSlowmoChange);
    this.eventBus.on("engine-render-update", this.onEngineUpdate);
  }

  private onCameraChange = () => {
    const camera = this.stage.renderCamera;
    this.scenePass.setCamera(camera);
    this.vsmPass.setCamera(camera);
    this.waterPass.setCamera(camera);
  };

  private onSlowmoChange = (isEnabled: boolean) => {
    this.saturationTarget = 1;
    if (isEnabled) this.saturationTarget = 0;
  };

  private onEngineUpdate = ({ delta, player }: State) => {
    const { width, height } = this.renderer.domElement;
    const { halfSize } = this.sunView;
    const camera = this.sunViewCamera;
    camera.left = -halfSize * (width / height);
    camera.right = halfSize * (width / height);
    camera.top = halfSize;
    camera.bottom = -halfSize;
    camera.updateProjectionMatrix();
    this.uSunViewFocus.value.copy(player.position);
    camera.position
      .copy(this.lighting.sunDirection)
      .multiplyScalar(-SUN_VIEW_DISTANCE)
      .add(player.position);
    camera.lookAt(player.position);
    camera.updateMatrixWorld();
    this.uSunViewProjection.value.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.uSunViewProjectionInverse.value.copy(camera.projectionMatrixInverse);
    this.uSunViewCameraWorld.value.copy(camera.matrixWorld);
    const { renderCamera } = this.stage;
    this.uMainViewProjection.value.multiplyMatrices(
      renderCamera.projectionMatrix,
      renderCamera.matrixWorldInverse,
    );
    renderCamera.getWorldPosition(this.uMainCameraPosition.value);
    const { saturation } = this.acesToneMappingPass;
    if (saturation.value === this.saturationTarget) return;
    const t = 1 - Math.exp(-this.saturationLerpSpeed * delta);
    saturation.value += (this.saturationTarget - saturation.value) * t;
  };

  private addBindings() {
    const viewOptions: Record<string, string> = {};
    for (const view of Object.keys(this.debugOutputs)) viewOptions[view] = view;
    this.debugFolder
      .addBinding(this.debugView, "target", {
        label: "View",
        options: viewOptions,
      })
      .on("change", this.selectDebugView);
    let rows = 1;
    for (const legend of Object.values(this.debugLegends))
      rows = Math.max(rows, legend.split("\n").length);
    const legendBinding = this.debugFolder.addBinding(
      this.debugLegend,
      "text",
      {
        label: undefined,
        readonly: true,
        multiline: true,
        rows,
      },
    );
    this.debugFolder.addBinding(this.renderer, "toneMappingExposure", {
      label: "Exposure",
      min: 0,
      max: 10,
      step: 0.01,
    });
    this.debugFolder.addBinding(this.uDepthViewRange, "value", {
      label: "Depth range",
      min: 1,
      max: 1000,
      step: 1,
    });
    const bloomFolder = this.debugFolder.addFolder({
      title: "Bloom",
      expanded: false,
    });
    this.dualKawaseBloomPass.addBindings(bloomFolder);
    const shadowsFolder = this.debugFolder.addFolder({
      title: "Shadows",
      expanded: false,
    });
    this.vsmPass.addBindings(shadowsFolder);
    const sunViewFolder = this.debugFolder.addFolder({
      title: "Sun view",
      expanded: false,
    });
    sunViewFolder.addBinding(this.sunView, "halfSize", {
      label: "Size",
      min: 5,
      max: 1500,
      step: 1,
    });
    sunViewFolder.addBinding(this.uSunViewRange, "value", {
      label: "Depth range",
      min: 1,
      max: 300,
      step: 1,
    });
    const volumetricLightFolder = this.debugFolder.addFolder({
      title: "Volumetric light",
      expanded: false,
    });
    this.vsmPass.volumetricLight.addBindings(volumetricLightFolder);
    return legendBinding;
  }

  private selectDebugView = () => {
    const { target } = this.debugView;
    this.outputNode = this.debugOutputs[target] ?? this.debugOutputs.Scene;
    this.needsUpdate = true;
    const legend = this.debugLegends[target];
    this.debugLegend.text = legend ?? "";
    this.debugLegendBinding.hidden = !legend;
  };

  async compileAsync() {
    await this.scenePass.compileAsync(this.renderer);
    await this.waterPass.compileAsync(this.renderer);
  }

  sampleMainSceneColor(uv: Node<"vec2">) {
    return this.vsmPass.sampleShadowedColor(uv);
  }

  get mainSceneDepthNode() {
    return this.scenePass.depth;
  }

  render() {
    const toneMapping = this.renderer.toneMapping;
    const outputColorSpace = this.renderer.outputColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.outputColorSpace = ColorManagement.workingColorSpace;
    try {
      this.chain.render();
    } finally {
      this.renderer.toneMapping = toneMapping;
      this.renderer.outputColorSpace = outputColorSpace;
    }
    super.render();
  }
}
