import { HalfFloatType, Matrix4, Vector2, type Camera } from "three";
import {
  NodeMaterial,
  QuadMesh,
  RenderTarget,
  type Node,
  type TextureNode,
  type WebGPURenderer,
} from "three/webgpu";
import {
  exp,
  float,
  Fn,
  interleavedGradientNoise,
  Loop,
  mix,
  screenCoordinate,
  screenUV,
  texture,
  uniform,
  vec2,
  vec4,
} from "three/tsl";
import type { DebugFolder } from "../debug/DebugPanel";
import type { Lighting } from "../lighting/Lighting";
import type { VSMContext } from "./VSMContext";
import { getReceiverLevel } from "./VSMMath";
import type { VSMSampler } from "./VSMSampler";

type FloatNode = Node<"float">;

const STEP_COUNT = 4;
const RESOLUTION_SCALE = 0.125;
const HISTORY_WEIGHT = 0.9;
const JITTER_FRAMES = 64;
const JITTER_STEP = 5.588238;
// 4x the distance is 2 levels coarser, fine pages are rarely resident in the air
const SEARCH_DISTANCE_SCALE = 4;

const getHenyeyGreenstein = (cosTheta: FloatNode, anisotropy: FloatNode) => {
  const anisotropySquared = anisotropy.mul(anisotropy);
  const numerator = float(1).sub(anisotropySquared);
  const denominatorBase = float(1)
    .add(anisotropySquared)
    .sub(anisotropy.mul(cosTheta).mul(2));
  const denominator = denominatorBase.pow(1.5).mul(4 * Math.PI);
  return numerator.div(denominator);
};

const createHistoryTarget = () =>
  new RenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });

export class VSMVolumetricLight {
  private readonly intensity = uniform(1);
  private readonly density = uniform(0.01);
  private readonly anisotropy = uniform(0.6);
  private readonly maxDistance = uniform(80);
  private readonly jitterOffset = uniform(0);
  private readonly previousViewProjection = uniform(new Matrix4());
  private renderer: WebGPURenderer;
  private camera: Camera;
  private context: VSMContext;
  private sampler: VSMSampler;
  private lighting: Lighting;
  private historyTargets = [createHistoryTarget(), createHistoryTarget()];
  private history: TextureNode;
  private resolved: TextureNode;
  private volumetricQuad: QuadMesh;
  private drawingBufferSize = new Vector2();
  private viewProjection = new Matrix4();
  private frame = 0;

  constructor(
    renderer: WebGPURenderer,
    camera: Camera,
    context: VSMContext,
    sampler: VSMSampler,
    lighting: Lighting,
  ) {
    this.renderer = renderer;
    this.camera = camera;
    this.context = context;
    this.sampler = sampler;
    this.lighting = lighting;
    const [current, previous] = this.historyTargets;
    this.resolved = texture(current.texture);
    this.history = texture(previous.texture);
    const volumetricMaterial = new NodeMaterial();
    volumetricMaterial.name = "Volumetric light";
    volumetricMaterial.fragmentNode = this.computeVolumetricLight();
    this.volumetricQuad = new QuadMesh(volumetricMaterial);
    this.volumetricQuad.name = "Volumetric light";
  }

  setCamera(camera: Camera) {
    this.camera = camera;
  }

  apply(sceneColor: Node<"vec4">) {
    return sceneColor.add(vec4(this.sample(), 0));
  }

  sample() {
    return this.resolved.sample(screenUV).rgb;
  }

  render() {
    const { camera } = this;
    this.previousViewProjection.value.copy(this.viewProjection);
    this.viewProjection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.frame = (this.frame + 1) % JITTER_FRAMES;
    this.jitterOffset.value = this.frame * JITTER_STEP;

    const [current, previous] = this.historyTargets;
    this.renderer.getDrawingBufferSize(this.drawingBufferSize);
    const width = Math.max(
      1,
      Math.floor(this.drawingBufferSize.x * RESOLUTION_SCALE),
    );
    const height = Math.max(
      1,
      Math.floor(this.drawingBufferSize.y * RESOLUTION_SCALE),
    );
    current.setSize(width, height);
    this.history.value = previous.texture;
    const previousRenderTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(current);
    this.volumetricQuad.render(this.renderer);
    this.renderer.setRenderTarget(previousRenderTarget);
    this.resolved.value = current.texture;
    this.historyTargets.reverse();
  }

  addBindings(folder: DebugFolder) {
    folder.addBinding(this.intensity, "value", {
      label: "Intensity",
      min: 0,
      max: 10,
      step: 0.1,
    });
    folder.addBinding(this.density, "value", {
      label: "Density",
      min: 0,
      max: 0.1,
      step: 0.001,
    });
    folder.addBinding(this.anisotropy, "value", {
      label: "Forward scattering",
      min: 0,
      max: 0.95,
      step: 0.01,
    });
    folder.addBinding(this.maxDistance, "value", {
      label: "Distance",
      min: 10,
      max: 200,
      step: 1,
    });
  }

  private computeInScattering = Fn<
    [depth: FloatNode, worldPosition: Node<"vec3">, viewDistance: FloatNode],
    Node<"vec3">
  >(([depth, worldPosition, viewDistance]) => {
    const { cameraPosition, sunDirection } = this.context;
    const rayDirection = worldPosition.sub(cameraPosition).normalize().toVar();
    const isSky = depth.greaterThanEqual(1);
    const surfaceDistance = mix(viewDistance, this.maxDistance, float(isSky));
    const rayLength = surfaceDistance.min(this.maxDistance).toVar();
    const stepLength = rayLength.div(STEP_COUNT).toVar();
    const jitterPixel = screenCoordinate.xy.add(this.jitterOffset);
    const jitter = interleavedGradientNoise(jitterPixel).toVar();
    const litSum = float(0).toVar();
    Loop(STEP_COUNT, ({ i }) => {
      const stepDistance = float(i).add(jitter).mul(stepLength);
      const stepPosition = cameraPosition.add(rayDirection.mul(stepDistance));
      const level = getReceiverLevel(stepDistance.mul(SEARCH_DISTANCE_SCALE));
      litSum.addAssign(this.sampler.sampleSunVisibility(stepPosition, level));
    });
    const litFraction = litSum.div(STEP_COUNT);
    const cosTheta = rayDirection.dot(sunDirection.negate());
    const phase = getHenyeyGreenstein(cosTheta, this.anisotropy);
    const opticalDepth = this.density.mul(rayLength);
    const scattering = float(1).sub(exp(opticalDepth.negate()));
    return this.lighting.uSunRadiance
      .mul(phase)
      .mul(scattering)
      .mul(litFraction)
      .mul(this.intensity);
  });

  private computeVolumetricLight = Fn<[], Node<"vec4">>(() => {
    const { depth, worldPosition, viewDistance } =
      this.sampler.getReceiver(screenUV);
    const inScattering = this.computeInScattering(
      depth,
      worldPosition,
      viewDistance,
    );
    const current = vec4(inScattering, 1);
    const previousClip = this.previousViewProjection.mul(
      vec4(worldPosition, 1),
    );
    const previousNdc = previousClip.xy.div(previousClip.w);
    const previousUv = vec2(
      previousNdc.x.mul(0.5).add(0.5),
      previousNdc.y.mul(-0.5).add(0.5),
    ).toVar();
    const uvMinimum = previousUv.x.min(previousUv.y);
    const uvMaximum = previousUv.x.max(previousUv.y);
    const isOnScreen = uvMinimum
      .greaterThanEqual(0)
      .and(uvMaximum.lessThanEqual(1));
    const history = this.history.sample(previousUv);
    const historyWeight = float(isOnScreen).mul(HISTORY_WEIGHT);
    return mix(current, history, historyWeight);
  });
}
