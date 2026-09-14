import {
  Box3,
  DepthTexture,
  GreaterEqualCompare,
  LessEqualCompare,
  LinearFilter,
  NearestFilter,
  NoColorSpace,
  RedFormat,
  RenderTarget,
  type Mesh,
  type Object3D,
  UnsignedByteType,
  UnsignedShortType,
  Vector2,
  Vector3,
  Vector4,
} from "three";
import { RendererUtils, type Node, type WebGPURenderer } from "three/webgpu";
import {
  float,
  Fn,
  If,
  mix,
  smoothstep,
  step,
  texture,
  uniform,
  vec2,
  vec4,
} from "three/tsl";
import type { LightingManager } from "../LightingManager";
import type { AssetManager } from "../AssetManager/AssetManager";
import { DynamicShadowLevel } from "./DynamicShadowLevel";
import { DynamicShadowCasterBatch } from "./DynamicShadowCasterBatch";
import {
  dynamicShadowLevelSettings,
  dynamicShadowSettings,
} from "./ShadowSettings";

const NEAR_RESOLUTION = dynamicShadowLevelSettings[0].resolution;
const FAR_RESOLUTION = dynamicShadowLevelSettings[1].resolution;
const ATLAS_WIDTH = NEAR_RESOLUTION + FAR_RESOLUTION;
const ATLAS_HEIGHT = Math.max(NEAR_RESOLUTION, FAR_RESOLUTION);
const ATLAS_REGIONS = [
  { x: 0, y: 0, size: NEAR_RESOLUTION },
  { x: NEAR_RESOLUTION, y: 0, size: FAR_RESOLUTION },
] as const;

type DynamicSurfaceArguments = [
  worldPosition: Node<"vec3">,
  worldNormal: Node<"vec3">,
];

export class DynamicShadowMap {
  readonly getFactor: (
    worldPosition: Node<"vec3">,
    worldNormal: Node<"vec3">,
  ) => Node<"float">;
  readonly levels: DynamicShadowLevel[];
  private renderer: WebGPURenderer;
  private casterBatch: DynamicShadowCasterBatch;
  private lightingManager: LightingManager;
  private depthTexture: DepthTexture;
  private renderTarget: RenderTarget;
  private uBias = uniform(dynamicShadowSettings.bias);
  private uNormalBias = uniform(dynamicShadowSettings.normalBias);
  private uEnabled = uniform(0);
  private uHasActiveCasters = uniform(0);
  private uPlayerXZ = uniform(new Vector2());
  private hasCasters = false;
  private rendererState: RendererUtils.RendererState;
  private sceneState: RendererUtils.SceneState;
  private receiverBounds = new Box3();
  private savedScissor = new Vector4();
  private savedViewport = new Vector4();

  get casterCount() {
    return this.casterBatch.casterCount;
  }

  get registeredCasterCount() {
    return this.casterBatch.registeredCasterCount;
  }

  get eligibleCasterCount() {
    return this.casterBatch.eligibleCasterCount;
  }

  get droppedCasterCount() {
    return this.casterBatch.droppedCasterCount;
  }

  get triangleCount() {
    return this.casterBatch.triangleCount;
  }

  constructor(
    renderer: WebGPURenderer,
    lightingManager: LightingManager,
    assetManager: AssetManager,
  ) {
    this.renderer = renderer;
    this.lightingManager = lightingManager;
    this.rendererState = RendererUtils.saveRendererState(renderer);
    this.depthTexture = this.createDepthTexture();
    this.renderTarget = this.createRenderTarget();
    this.levels = [];
    const receiverMinY = assetManager.resources.heightmap.userData.min ?? -32;
    const receiverMaxY = assetManager.resources.heightmap.userData.max ?? 64;
    for (let index = 0; index < dynamicShadowLevelSettings.length; index++) {
      const settings = dynamicShadowLevelSettings[index];
      this.levels.push(
        new DynamicShadowLevel(
          settings,
          ATLAS_REGIONS[index],
          receiverMinY,
          receiverMaxY,
        ),
      );
    }
    this.casterBatch = new DynamicShadowCasterBatch(
      this.levels,
      ATLAS_WIDTH,
      ATLAS_HEIGHT,
    );
    this.sceneState = RendererUtils.saveSceneState(this.casterBatch.scene);

    this.getFactor = Fn<DynamicSurfaceArguments, Node<"float">>(
      ([worldPosition, worldNormal]) => {
        const playerDelta = worldPosition.xz.sub(this.uPlayerXZ);
        const distanceSquared = playerDelta.dot(playerDelta);
        return this.getBlendedSurfaceFactor(
          distanceSquared,
          worldPosition,
          worldNormal,
        );
      },
    );
  }

  register(casters: Mesh[]) {
    if (casters.length === 0) return;
    this.casterBatch.register(casters);
    this.hasCasters = true;
    this.applySettings();
  }

  registerReceiver(object: Object3D) {
    object.updateWorldMatrix(true, true);
    this.receiverBounds.setFromObject(object, true);
    if (this.receiverBounds.isEmpty()) return;
    for (const level of this.levels)
      level.includeReceiverBounds(this.receiverBounds);
  }

  applySettings() {
    this.uEnabled.value = Number(
      this.hasCasters && dynamicShadowSettings.isEnabled,
    );
    this.uBias.value = dynamicShadowSettings.bias;
    this.uNormalBias.value = dynamicShadowSettings.normalBias;
    for (const level of this.levels) level.applySettings();
  }

  render(playerPosition: Vector3) {
    this.uPlayerXZ.value.set(playerPosition.x, playerPosition.z);
    if (this.uEnabled.value === 0) return;

    for (const level of this.levels) {
      level.prepareProjection(
        playerPosition,
        this.lightingManager.sunDirection,
      );
    }
    const haveCastersChanged = this.casterBatch.prepare();
    let hasProjectionChanged = false;
    for (let index = 0; index < this.levels.length; index++) {
      if (
        this.levels[index].finishProjection(
          this.casterBatch.getCasterBounds(index),
        )
      )
        hasProjectionChanged = true;
    }
    this.uHasActiveCasters.value = Number(this.casterBatch.isReady);
    if (!this.casterBatch.isReady) return;
    if (!hasProjectionChanged && !haveCastersChanged) return;

    this.renderer.getViewport(this.savedViewport);
    this.renderer.getScissor(this.savedScissor);
    try {
      this.rendererState = RendererUtils.resetRendererState(
        this.renderer,
        this.rendererState,
      );
      this.sceneState = RendererUtils.resetSceneState(
        this.casterBatch.scene,
        this.sceneState,
      );
      this.renderer.setClearColor(0x000000, 0);
      this.renderTarget.viewport.set(0, 0, ATLAS_WIDTH, ATLAS_HEIGHT);
      this.renderTarget.scissorTest = false;
      this.renderer.setRenderTarget(this.renderTarget);
      this.renderer.autoClear = true;
      this.renderer.render(this.casterBatch.scene, this.casterBatch.camera);
    } finally {
      RendererUtils.restoreRendererState(this.renderer, this.rendererState);
      this.renderer.setViewport(this.savedViewport);
      this.renderer.setScissor(this.savedScissor);
      RendererUtils.restoreSceneState(this.casterBatch.scene, this.sceneState);
    }
  }

  private getBlendedSurfaceFactor(
    distanceSquared: Node<"float">,
    worldPosition: Node<"vec3">,
    worldNormal: Node<"vec3">,
  ) {
    const near = this.levels[0];
    const far = this.levels[1];
    const nearBlendStart = near.settings.radius - near.settings.blendDistance;
    const farBlendStart = far.settings.radius - far.settings.blendDistance;
    const factor = float(1).toVar();
    If(this.uEnabled.mul(this.uHasActiveCasters).lessThanEqual(0.5), () => {
      factor.assign(1);
    })
      .ElseIf(distanceSquared.lessThan(nearBlendStart ** 2), () => {
        factor.assign(
          this.getSurfaceLevelFactor(near, worldPosition, worldNormal),
        );
      })
      .ElseIf(distanceSquared.lessThan(near.settings.radius ** 2), () => {
        const nearFactor = this.getSurfaceLevelFactor(
          near,
          worldPosition,
          worldNormal,
        );
        const farFactor = this.getSurfaceLevelFactor(
          far,
          worldPosition,
          worldNormal,
        );
        const levelBlend = smoothstep(
          nearBlendStart,
          near.settings.radius,
          distanceSquared.sqrt(),
        );
        factor.assign(mix(nearFactor, farFactor, levelBlend));
      })
      .ElseIf(distanceSquared.lessThan(farBlendStart ** 2), () => {
        factor.assign(
          this.getSurfaceLevelFactor(far, worldPosition, worldNormal),
        );
      })
      .ElseIf(distanceSquared.lessThan(far.settings.radius ** 2), () => {
        const farFactor = this.getSurfaceLevelFactor(
          far,
          worldPosition,
          worldNormal,
        );
        const farFade = smoothstep(
          farBlendStart,
          far.settings.radius,
          distanceSquared.sqrt(),
        );
        factor.assign(mix(farFactor, 1, farFade));
      })
      .Else(() => {
        factor.assign(1);
      });
    return factor.clamp(0, 1);
  }

  private getSurfaceLevelFactor(
    level: DynamicShadowLevel,
    worldPosition: Node<"vec3">,
    worldNormal: Node<"vec3">,
  ) {
    const biasedPosition = worldPosition.add(worldNormal.mul(this.uNormalBias));
    const projected = level.uMatrix.mul(vec4(biasedPosition, 1));
    const shadowCoord = projected.xyz.div(projected.w);
    const sampleUv = vec2(shadowCoord.x, float(1).sub(shadowCoord.y));
    const compareDepth = this.renderer.reversedDepthBuffer
      ? shadowCoord.z.sub(this.uBias)
      : shadowCoord.z.add(this.uBias);
    const atlasUv = this.getAtlasUv(level, sampleUv, 2);
    const visibility = texture(this.depthTexture, atlasUv).compare(
      compareDepth,
    ).r;
    return mix(1, visibility, this.getInsideFactor(shadowCoord));
  }

  private getInsideFactor(shadowCoord: Node<"vec3">) {
    return step(0, shadowCoord.x)
      .mul(step(shadowCoord.x, 1))
      .mul(step(0, shadowCoord.y))
      .mul(step(shadowCoord.y, 1))
      .mul(step(0, shadowCoord.z))
      .mul(step(shadowCoord.z, 1));
  }

  private getAtlasUv(
    level: DynamicShadowLevel,
    sampleUv: Node<"vec2">,
    insetTexels = 0,
  ) {
    const { size, x, y } = level.atlasRegion;
    const scale = vec2(size / ATLAS_WIDTH, size / ATLAS_HEIGHT);
    const offset = vec2(x / ATLAS_WIDTH, y / ATLAS_HEIGHT);
    const inset = insetTexels / size;
    const safeUv = sampleUv.clamp(vec2(inset), vec2(1 - inset));
    return safeUv.mul(scale).add(offset);
  }

  private createDepthTexture() {
    const depthTexture = new DepthTexture(
      ATLAS_WIDTH,
      ATLAS_HEIGHT,
      UnsignedShortType,
    );
    depthTexture.name = "Dynamic shadow atlas depth";
    depthTexture.minFilter = LinearFilter;
    depthTexture.magFilter = LinearFilter;
    depthTexture.compareFunction = this.renderer.reversedDepthBuffer
      ? GreaterEqualCompare
      : LessEqualCompare;
    return depthTexture;
  }

  private createRenderTarget() {
    const renderTarget = new RenderTarget(ATLAS_WIDTH, ATLAS_HEIGHT, {
      depthTexture: this.depthTexture,
      format: RedFormat,
      magFilter: NearestFilter,
      minFilter: NearestFilter,
      stencilBuffer: false,
      type: UnsignedByteType,
    });
    renderTarget.texture.name = "Dynamic shadow atlas target";
    renderTarget.texture.colorSpace = NoColorSpace;
    return renderTarget;
  }
}
