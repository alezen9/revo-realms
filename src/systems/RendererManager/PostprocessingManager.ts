import { ACESFilmicToneMapping, Matrix4, NoToneMapping, Vector3 } from "three";
import { RenderPipeline, WebGPURenderer } from "three/webgpu";
import {
  float,
  Fn,
  getViewPosition,
  If,
  int,
  max,
  mix,
  pass,
  renderOutput,
  screenUV,
  smoothstep,
  step,
  textureLevel,
  toneMapping,
  toneMappingExposure,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import type { DebugManager } from "../DebugManager";
import type { EventsManager } from "../EventsManager";
import type { SceneManager } from "../SceneManager";
import type { FolderApi } from "tweakpane";
import { assetManager, lightingManager } from "..";
import { playerUniforms } from "../../entities/Player/PlayerMaterial";
import { TSLUtils } from "../../utils/TSLUtils";

const MAIN_SCENE_PASS_SAMPLES = 4;
const LUMINANCE_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);
const BALL_SHADOW_PENUMBRA = 0.08;
const BALL_DEPTH_MATCH_EPSILON = 0.05;

export class PostprocessingManager extends RenderPipeline {
  private mainScenePass: ReturnType<typeof pass>;
  private waterPass: ReturnType<typeof pass>;
  private uSaturation = uniform(1);
  private uProjectionMatrixInverse = uniform(new Matrix4());
  private uCameraWorldMatrix = uniform(new Matrix4());
  private uCameraPosition = uniform(new Vector3());
  private saturationTarget = 1;
  private saturationLerpSpeed = 14;
  private sceneManager: SceneManager;
  private eventsManager: EventsManager;
  private debugManager: DebugManager;
  private debugFolder: FolderApi;

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
    return this.mainScenePass.getTextureNode();
  }

  get mainSceneDepthNode() {
    return this.mainScenePass.getTextureNode("depth");
  }

  private makeGraph() {
    this.outputColorTransform = false;
    const mainSceneColor = this.mainScenePass.getTextureNode();
    const water = this.waterPass.getTextureNode();
    const colorHDR = mainSceneColor.mul(water.a.oneMinus()).add(water.rgb);

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
    const shadowFactor = this.computeBallShadowFactor();
    const shadowedHDR = mix(
      withBloomHDR.mul(lightingManager.uPlayerShadowBrightness),
      withBloomHDR,
      shadowFactor,
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
}
