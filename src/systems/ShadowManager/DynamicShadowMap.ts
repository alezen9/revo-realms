import {
  DepthTexture,
  DirectionalLight,
  GreaterEqualCompare,
  LessEqualCompare,
  LinearFilter,
  Matrix4,
  NoColorSpace,
  RenderTarget,
  type Scene,
  Vector3,
  WebGPUCoordinateSystem,
} from "three";
import {
  MeshBasicNodeMaterial,
  type Node,
  type WebGPURenderer,
} from "three/webgpu";
import {
  float,
  Fn,
  If,
  mix,
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
import { DYNAMIC_SHADOW_LAYER, dynamicShadowSettings } from "./ShadowSettings";

type DynamicShadowArguments = [
  worldPosition: Node<"vec3">,
  worldNormal: Node<"vec3">,
];

export class DynamicShadowMap {
  readonly getFactor: (
    worldPosition: Node<"vec3">,
    worldNormal: Node<"vec3">,
  ) => Node<"float">;
  readonly getGroundFactor: (worldPosition: Node<"vec3">) => Node<"float">;
  private renderer: WebGPURenderer;
  private scene: Scene;
  private lightingManager: LightingManager;
  private light = new DirectionalLight();
  private depthTexture: DepthTexture;
  private renderTarget: RenderTarget;
  private depthMaterial = new MeshBasicNodeMaterial({
    colorWrite: false,
    depthTest: true,
    depthWrite: true,
  });
  private uMatrix = uniform(new Matrix4());
  private uBias = uniform(dynamicShadowSettings.bias);
  private uNormalBias = uniform(dynamicShadowSettings.normalBias);
  private uEnabled = uniform(0);
  private center = new Vector3();
  private lightPosition = new Vector3();
  private lightRight = new Vector3();
  private lightUp = new Vector3();
  private lightForward = new Vector3();
  private hasCasters = false;

  constructor(
    renderer: WebGPURenderer,
    scene: Scene,
    lightingManager: LightingManager,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.lightingManager = lightingManager;
    this.depthTexture = this.createDepthTexture();
    this.renderTarget = this.createRenderTarget();
    this.configureLight();
    this.getFactor = Fn<DynamicShadowArguments, Node<"float">>(
      ([worldPosition, worldNormal]) => {
        const result = float(1).toVar();
        If(this.uEnabled, () => {
          const biasedPosition = worldPosition.add(
            worldNormal.mul(this.uNormalBias),
          );
          const projected = this.uMatrix.mul(vec4(biasedPosition, 1));
          const shadowCoord = projected.xyz.div(projected.w);
          const sampleUv = vec2(shadowCoord.x, float(1).sub(shadowCoord.y));
          const compareDepth = this.renderer.reversedDepthBuffer
            ? shadowCoord.z.sub(this.uBias)
            : shadowCoord.z.add(this.uBias);
          const visibility = texture(this.depthTexture, sampleUv).compare(
            compareDepth,
          ).r;
          const isInside = step(0, shadowCoord.x)
            .mul(step(shadowCoord.x, 1))
            .mul(step(0, shadowCoord.y))
            .mul(step(shadowCoord.y, 1))
            .mul(step(0, shadowCoord.z))
            .mul(step(shadowCoord.z, 1));
          result.assign(mix(1, visibility, isInside));
        });
        return result;
      },
    );
    this.getGroundFactor = Fn<[worldPosition: Node<"vec3">], Node<"float">>(
      ([worldPosition]) => {
        const result = float(1).toVar();
        If(this.uEnabled, () => {
          const biasedPosition = worldPosition.add(
            vec3(0, 1, 0).mul(this.uNormalBias),
          );
          const projected = this.uMatrix.mul(vec4(biasedPosition, 1));
          const shadowCoord = projected.xyz.div(projected.w);
          const sampleUv = vec2(shadowCoord.x, float(1).sub(shadowCoord.y));
          const maxTexel = dynamicShadowSettings.resolution - 1;
          const texelCoord = uvec2(sampleUv.mul(maxTexel).clamp(0, maxTexel));
          const sampleDepth = textureLoad(this.depthTexture, texelCoord).r;
          const compareDepth = this.renderer.reversedDepthBuffer
            ? shadowCoord.z.sub(this.uBias)
            : shadowCoord.z.add(this.uBias);
          const visibility = this.renderer.reversedDepthBuffer
            ? step(sampleDepth, compareDepth)
            : step(compareDepth, sampleDepth);
          const isInside = step(0, shadowCoord.x)
            .mul(step(shadowCoord.x, 1))
            .mul(step(0, shadowCoord.y))
            .mul(step(shadowCoord.y, 1))
            .mul(step(0, shadowCoord.z))
            .mul(step(shadowCoord.z, 1));
          result.assign(mix(1, visibility, isInside));
        });
        return result;
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
    const camera = this.light.shadow.camera;
    const halfExtent = dynamicShadowSettings.radius * Math.SQRT2;
    camera.left = -halfExtent;
    camera.right = halfExtent;
    camera.bottom = -halfExtent;
    camera.top = halfExtent;
    camera.updateProjectionMatrix();
  }

  render(playerPosition: Vector3) {
    if (this.uEnabled.value === 0) return;
    this.updateProjection(playerPosition);

    const previousTarget = this.renderer.getRenderTarget();
    const previousCubeFace = this.renderer.getActiveCubeFace();
    const previousMipmapLevel = this.renderer.getActiveMipmapLevel();
    const previousOverrideMaterial = this.scene.overrideMaterial;

    try {
      this.scene.overrideMaterial = this.depthMaterial;
      this.renderer.setRenderTarget(this.renderTarget);
      this.renderer.render(this.scene, this.light.shadow.camera);
    } finally {
      this.scene.overrideMaterial = previousOverrideMaterial;
      this.renderer.setRenderTarget(
        previousTarget,
        previousCubeFace,
        previousMipmapLevel,
      );
    }
  }

  private createDepthTexture() {
    const { resolution } = dynamicShadowSettings;
    const depthTexture = new DepthTexture(resolution, resolution);
    depthTexture.name = "Dynamic shadow depth";
    depthTexture.colorSpace = NoColorSpace;
    depthTexture.minFilter = LinearFilter;
    depthTexture.magFilter = LinearFilter;
    depthTexture.compareFunction = this.renderer.reversedDepthBuffer
      ? GreaterEqualCompare
      : LessEqualCompare;
    return depthTexture;
  }

  private createRenderTarget() {
    const { resolution } = dynamicShadowSettings;
    const renderTarget = new RenderTarget(resolution, resolution, {
      depthTexture: this.depthTexture,
      stencilBuffer: false,
    });
    renderTarget.texture.name = "Dynamic shadow target";
    renderTarget.texture.colorSpace = NoColorSpace;
    return renderTarget;
  }

  private configureLight() {
    const camera = this.light.shadow.camera;
    camera.coordinateSystem = WebGPUCoordinateSystem;
    camera.layers.set(DYNAMIC_SHADOW_LAYER);
    camera.near = 32;
    camera.far = 224;
    this.applySettings();
  }

  private updateProjection(playerPosition: Vector3) {
    const { radius, resolution } = dynamicShadowSettings;
    const projectionSize = radius * Math.SQRT2 * 2;
    const texelSize = projectionSize / resolution;

    this.lightForward.copy(this.lightingManager.sunDirection).normalize();
    this.lightRight.set(0, 1, 0).cross(this.lightForward).normalize();
    this.lightUp.crossVectors(this.lightForward, this.lightRight).normalize();

    this.center.set(playerPosition.x, 16, playerPosition.z);
    const rightDistance = this.center.dot(this.lightRight);
    const upDistance = this.center.dot(this.lightUp);
    const forwardDistance = this.center.dot(this.lightForward);
    const snappedRight = Math.round(rightDistance / texelSize) * texelSize;
    const snappedUp = Math.round(upDistance / texelSize) * texelSize;

    this.center
      .copy(this.lightRight)
      .multiplyScalar(snappedRight)
      .addScaledVector(this.lightUp, snappedUp)
      .addScaledVector(this.lightForward, forwardDistance);
    this.light.target.position.copy(this.center);
    this.light.target.updateMatrixWorld();
    this.lightPosition
      .copy(this.lightForward)
      .multiplyScalar(-128)
      .add(this.center);
    this.light.position.copy(this.lightPosition);
    this.light.updateMatrixWorld();
    this.light.shadow.updateMatrices(this.light);
    this.uMatrix.value.copy(this.light.shadow.matrix);
  }
}
