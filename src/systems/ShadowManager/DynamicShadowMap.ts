import {
  DepthTexture,
  GreaterEqualCompare,
  LessEqualCompare,
  LinearFilter,
  NearestFilter,
  NoColorSpace,
  RedFormat,
  RenderTarget,
  type Scene,
  UnsignedByteType,
  UnsignedShortType,
  Vector2,
  Vector3,
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
  textureLoad,
  uniform,
  uvec2,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { LightingManager } from "../LightingManager";
import { DynamicShadowLevel } from "./DynamicShadowLevel";
import {
  dynamicShadowLevelSettings,
  dynamicShadowSettings,
} from "./ShadowSettings";

const ATLAS_WIDTH = 1536;
const ATLAS_HEIGHT = 1024;
const ATLAS_REGIONS = [
  { x: 0, y: 0, size: 1024 },
  { x: 1024, y: 0, size: 512 },
] as const;

type DynamicSurfaceArguments = [
  worldPosition: Node<"vec3">,
  worldNormal: Node<"vec3">,
];

type DynamicGroundArguments = [
  worldPosition: Node<"vec3">,
  sampleHash: Node<"float">,
];

export class DynamicShadowMap {
  readonly getFactor: (
    worldPosition: Node<"vec3">,
    worldNormal: Node<"vec3">,
  ) => Node<"float">;
  readonly getGroundFactor: (
    worldPosition: Node<"vec3">,
    sampleHash: Node<"float">,
  ) => Node<"float">;
  readonly levels: DynamicShadowLevel[];
  private renderer: WebGPURenderer;
  private scene: Scene;
  private lightingManager: LightingManager;
  private depthTexture: DepthTexture;
  private renderTarget: RenderTarget;
  private uBias = uniform(dynamicShadowSettings.bias);
  private uNormalBias = uniform(dynamicShadowSettings.normalBias);
  private uEnabled = uniform(0);
  private uPlayerXZ = uniform(new Vector2());
  private hasCasters = false;
  private rendererState: RendererUtils.RendererState;
  private sceneState: RendererUtils.SceneState;

  constructor(
    renderer: WebGPURenderer,
    scene: Scene,
    lightingManager: LightingManager,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.lightingManager = lightingManager;
    this.rendererState = RendererUtils.saveRendererState(renderer);
    this.sceneState = RendererUtils.saveSceneState(scene);
    this.depthTexture = this.createDepthTexture();
    this.renderTarget = this.createRenderTarget();
    this.levels = [];
    for (let index = 0; index < dynamicShadowLevelSettings.length; index++) {
      const settings = dynamicShadowLevelSettings[index];
      this.levels.push(new DynamicShadowLevel(settings, ATLAS_REGIONS[index]));
    }

    this.getFactor = Fn<DynamicSurfaceArguments, Node<"float">>(
      ([worldPosition, worldNormal]) => {
        const distance = worldPosition.xz.sub(this.uPlayerXZ).length();
        const factor = this.getBlendedSurfaceFactor(
          distance,
          worldPosition,
          worldNormal,
        );
        return mix(1, factor, this.uEnabled);
      },
    );

    this.getGroundFactor = Fn<DynamicGroundArguments, Node<"float">>(
      ([worldPosition, sampleHash]) => {
        const distance = worldPosition.xz.sub(this.uPlayerXZ).length();
        const factor = this.getBlendedGroundFactor(
          distance,
          worldPosition,
          sampleHash,
        );
        return mix(1, factor, this.uEnabled);
      },
    );
  }

  enable() {
    this.hasCasters = true;
    this.applySettings();
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
      level.updateProjection(playerPosition, this.lightingManager.sunDirection);
    }

    try {
      this.rendererState = RendererUtils.resetRendererState(
        this.renderer,
        this.rendererState,
      );
      this.sceneState = RendererUtils.resetSceneState(
        this.scene,
        this.sceneState,
      );
      this.renderer.setClearColor(0x000000, 0);
      for (let index = 0; index < this.levels.length; index++) {
        const level = this.levels[index];
        this.scene.overrideMaterial = level.depthMaterial;
        level.applyRenderRegion(this.renderTarget);
        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.autoClear = index === 0;
        this.renderer.render(this.scene, level.light.shadow.camera);
      }
    } finally {
      RendererUtils.restoreRendererState(this.renderer, this.rendererState);
      RendererUtils.restoreSceneState(this.scene, this.sceneState);
    }
  }

  private getBlendedSurfaceFactor(
    distance: Node<"float">,
    worldPosition: Node<"vec3">,
    worldNormal: Node<"vec3">,
  ) {
    const near = this.levels[0];
    const far = this.levels[1];
    const nearBlendStart = near.settings.radius - near.settings.blendDistance;
    const farBlendStart = far.settings.radius - far.settings.blendDistance;
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
      distance,
    );
    const farFade = smoothstep(farBlendStart, far.settings.radius, distance);
    return mix(mix(nearFactor, farFactor, levelBlend), 1, farFade);
  }

  private getBlendedGroundFactor(
    distance: Node<"float">,
    worldPosition: Node<"vec3">,
    sampleHash: Node<"float">,
  ) {
    const near = this.levels[0];
    const far = this.levels[1];
    const nearBlendStart = near.settings.radius - near.settings.blendDistance;
    const farBlendStart = far.settings.radius - far.settings.blendDistance;
    const nearFactor = this.getGroundLevelFactor(
      near,
      worldPosition,
      sampleHash,
    );
    const farFactor = this.getGroundLevelFactor(far, worldPosition, sampleHash);
    const levelBlend = smoothstep(
      nearBlendStart,
      near.settings.radius,
      distance,
    );
    const farFade = smoothstep(farBlendStart, far.settings.radius, distance);
    return mix(mix(nearFactor, farFactor, levelBlend), 1, farFade);
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
    const atlasUv = this.getAtlasUv(level, sampleUv);
    const visibility = texture(this.depthTexture, atlasUv).compare(
      compareDepth,
    ).r;
    const filtered = visibility.toVar();

    If(visibility.greaterThan(0).and(visibility.lessThan(1)), () => {
      const texel = vec2(1 / ATLAS_WIDTH, 1 / ATLAS_HEIGHT);
      const horizontal = texture(
        this.depthTexture,
        atlasUv.add(vec2(texel.x, 0)),
      )
        .compare(compareDepth)
        .r.add(
          texture(this.depthTexture, atlasUv.sub(vec2(texel.x, 0))).compare(
            compareDepth,
          ).r,
        );
      const vertical = texture(this.depthTexture, atlasUv.add(vec2(0, texel.y)))
        .compare(compareDepth)
        .r.add(
          texture(this.depthTexture, atlasUv.sub(vec2(0, texel.y))).compare(
            compareDepth,
          ).r,
        );
      filtered.assign(visibility.add(horizontal).add(vertical).mul(0.2));
    });

    return mix(1, filtered, this.getInsideFactor(shadowCoord));
  }

  private getGroundLevelFactor(
    level: DynamicShadowLevel,
    worldPosition: Node<"vec3">,
    sampleHash: Node<"float">,
  ) {
    const biasedPosition = worldPosition.add(
      vec3(0, 1, 0).mul(this.uNormalBias),
    );
    const projected = level.uMatrix.mul(vec4(biasedPosition, 1));
    const shadowCoord = projected.xyz.div(projected.w);
    const sampleUv = vec2(shadowCoord.x, float(1).sub(shadowCoord.y));
    const atlasUv = this.getAtlasUv(level, sampleUv);
    const { size, x, y } = level.atlasRegion;
    const jitter = vec2(
      sampleHash.mul(17.17).fract().sub(0.5),
      sampleHash.mul(71.53).fract().sub(0.5),
    );
    const texelCoord = uvec2(
      atlasUv
        .mul(vec2(ATLAS_WIDTH, ATLAS_HEIGHT))
        .add(jitter)
        .clamp(vec2(x, y), vec2(x + size - 1, y + size - 1)),
    );
    const sampleDepth = textureLoad(this.depthTexture, texelCoord).r;
    const compareDepth = this.renderer.reversedDepthBuffer
      ? shadowCoord.z.sub(this.uBias)
      : shadowCoord.z.add(this.uBias);
    const visibility = this.renderer.reversedDepthBuffer
      ? step(sampleDepth, compareDepth)
      : step(compareDepth, sampleDepth);
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

  private getAtlasUv(level: DynamicShadowLevel, sampleUv: Node<"vec2">) {
    const { size, x, y } = level.atlasRegion;
    const scale = vec2(size / ATLAS_WIDTH, size / ATLAS_HEIGHT);
    const offset = vec2(x / ATLAS_WIDTH, y / ATLAS_HEIGHT);
    return sampleUv.mul(scale).add(offset);
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
