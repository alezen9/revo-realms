import {
  HalfFloatType,
  NodeMaterial,
  NodeUpdateType,
  QuadMesh,
  RenderTarget,
  RendererUtils,
  TempNode,
  type Node,
  type NodeFrame,
  type TextureNode,
} from "three/webgpu";
import {
  Fn,
  luminance,
  mix,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { Vector2 } from "three";

const RESOLUTION_SCALE = 0.5;
const LOW_RESOLUTION_SCALE = RESOLUTION_SCALE * 0.5;
const UPSAMPLE_RADIUS = 2;
const PREFILTER_SAMPLES = [
  [0, 0, 0.125],
  [0, 2, 0.0625],
  [-2, 0, 0.0625],
  [2, 0, 0.0625],
  [0, -2, 0.0625],
  [-2, 2, 0.03125],
  [2, 2, 0.03125],
  [-2, -2, 0.03125],
  [2, -2, 0.03125],
  [-1, 1, 0.125],
  [1, 1, 0.125],
  [-1, -1, 0.125],
  [1, -1, 0.125],
] as const;
const TENT_SAMPLES = [
  [0, 0, 0.25],
  [0, 1, 0.125],
  [-1, 0, 0.125],
  [1, 0, 0.125],
  [0, -1, 0.125],
  [-1, 1, 0.0625],
  [1, 1, 0.0625],
  [-1, -1, 0.0625],
  [1, -1, 0.0625],
] as const;
const bloomQuad = new QuadMesh();

export class AntiFlickerBloomNode extends TempNode<"vec4"> {
  strength = uniform(1);
  radius = uniform(0);
  threshold = uniform(0);
  smoothWidth = uniform(0.04);

  private mainColor: TextureNode;
  private waterColor: TextureNode;
  private inputInvSize = uniform(new Vector2());
  private prefilterInvSize = uniform(new Vector2());
  private lowInvSize = uniform(new Vector2());
  private prefilterTarget = new RenderTarget(1, 1, {
    depthBuffer: false,
    type: HalfFloatType,
  });
  private lowTarget = new RenderTarget(1, 1, {
    depthBuffer: false,
    type: HalfFloatType,
  });
  private outputTarget = new RenderTarget(1, 1, {
    depthBuffer: false,
    type: HalfFloatType,
  });
  private prefilterTexture = texture(this.prefilterTarget.texture);
  private lowTexture = texture(this.lowTarget.texture);
  private outputTexture = texture(this.outputTarget.texture);
  private prefilterMaterial = new NodeMaterial();
  private downsampleMaterial = new NodeMaterial();
  private upsampleMaterial = new NodeMaterial();
  private drawingBufferSize = new Vector2();
  private rendererState?: ReturnType<typeof RendererUtils.saveRendererState>;

  private sampleHdr = Fn<[sampleUv: Node<"vec2">], Node<"vec3">>(
    ([sampleUv]) => {
      const main = this.mainColor.sample(sampleUv);
      const water = this.waterColor.sample(sampleUv);
      return main.rgb.mul(water.a.oneMinus()).add(water.rgb);
    },
  );

  private sampleBright = Fn<[sampleUv: Node<"vec2">], Node<"vec3">>(
    ([sampleUv]) => {
      const color = this.sampleHdr(sampleUv);
      const contribution = smoothstep(
        this.threshold,
        this.threshold.add(this.smoothWidth),
        luminance(color),
      );
      return color.mul(contribution);
    },
  );

  // the neighborhood filter runs before decimation so rotation cannot expose a sparse sampling grid
  private prefilter = Fn(() => {
    const screenUv = uv();
    const texel = this.inputInvSize;
    const color = vec3(0).toVar();
    for (const [x, y, weight] of PREFILTER_SAMPLES) {
      const sampleUv = screenUv.add(texel.mul(vec2(x, y)));
      color.addAssign(this.sampleBright(sampleUv).mul(weight));
    }

    return vec4(color, 1);
  });

  private downsample = Fn(() => {
    const screenUv = uv();
    const texel = this.prefilterInvSize;
    const color = vec3(0).toVar();
    for (const [x, y, weight] of TENT_SAMPLES) {
      const sampleUv = screenUv.add(texel.mul(vec2(x, y)));
      color.addAssign(this.prefilterTexture.sample(sampleUv).rgb.mul(weight));
    }

    return vec4(color, 1);
  });

  private upsample = Fn(() => {
    const screenUv = uv();
    const texel = this.lowInvSize.mul(UPSAMPLE_RADIUS);
    const low = vec3(0).toVar();
    for (const [x, y, weight] of TENT_SAMPLES) {
      const sampleUv = screenUv.add(texel.mul(vec2(x, y)));
      low.addAssign(this.lowTexture.sample(sampleUv).rgb.mul(weight));
    }

    const highWeight = mix(1, 0.2, this.radius);
    const lowWeight = mix(0.8, 0.4, this.radius);
    const high = this.prefilterTexture.sample(screenUv).rgb;
    return vec4(high.mul(highWeight).add(low.mul(lowWeight)), 1);
  });

  constructor(
    mainColor: TextureNode,
    waterColor: TextureNode,
    strength = 1,
    radius = 0,
    threshold = 0,
  ) {
    super("vec4");
    this.mainColor = mainColor;
    this.waterColor = waterColor;
    this.strength.value = strength;
    this.radius.value = radius;
    this.threshold.value = threshold;
    this.updateBeforeType = NodeUpdateType.FRAME;

    this.prefilterTarget.texture.name = "revo.bloom.prefilter";
    this.prefilterTarget.texture.generateMipmaps = false;
    this.lowTarget.texture.name = "revo.bloom.low";
    this.lowTarget.texture.generateMipmaps = false;
    this.outputTarget.texture.name = "revo.bloom.output";
    this.outputTarget.texture.generateMipmaps = false;
  }

  private setSize(width: number, height: number) {
    const prefilterWidth = Math.max(1, Math.floor(width * RESOLUTION_SCALE));
    const prefilterHeight = Math.max(1, Math.floor(height * RESOLUTION_SCALE));
    const lowWidth = Math.max(1, Math.floor(width * LOW_RESOLUTION_SCALE));
    const lowHeight = Math.max(1, Math.floor(height * LOW_RESOLUTION_SCALE));

    this.inputInvSize.value.set(1 / width, 1 / height);
    this.prefilterInvSize.value.set(1 / prefilterWidth, 1 / prefilterHeight);
    this.lowInvSize.value.set(1 / lowWidth, 1 / lowHeight);
    this.prefilterTarget.setSize(prefilterWidth, prefilterHeight);
    this.lowTarget.setSize(lowWidth, lowHeight);
    this.outputTarget.setSize(prefilterWidth, prefilterHeight);
  }

  updateBefore(frame: NodeFrame): undefined {
    const { renderer } = frame;
    if (!renderer) return undefined;

    if (!this.rendererState)
      this.rendererState = RendererUtils.saveRendererState(renderer);
    this.rendererState = RendererUtils.resetRendererState(
      renderer,
      this.rendererState,
    );

    const size = renderer.getDrawingBufferSize(this.drawingBufferSize);
    this.setSize(size.width, size.height);

    bloomQuad.material = this.prefilterMaterial;
    bloomQuad.name = "Revo Bloom [ Prefilter ]";
    renderer.setRenderTarget(this.prefilterTarget);
    bloomQuad.render(renderer);

    bloomQuad.material = this.downsampleMaterial;
    bloomQuad.name = "Revo Bloom [ Downsample ]";
    renderer.setRenderTarget(this.lowTarget);
    bloomQuad.render(renderer);

    bloomQuad.material = this.upsampleMaterial;
    bloomQuad.name = "Revo Bloom [ Upsample ]";
    renderer.setRenderTarget(this.outputTarget);
    bloomQuad.render(renderer);

    RendererUtils.restoreRendererState(renderer, this.rendererState);
    return undefined;
  }

  setup() {
    this.prefilterMaterial.fragmentNode = this.prefilter();
    this.prefilterMaterial.name = "RevoBloom_prefilter";
    this.prefilterMaterial.needsUpdate = true;

    this.downsampleMaterial.fragmentNode = this.downsample();
    this.downsampleMaterial.name = "RevoBloom_downsample";
    this.downsampleMaterial.needsUpdate = true;

    this.upsampleMaterial.fragmentNode = this.upsample();
    this.upsampleMaterial.name = "RevoBloom_upsample";
    this.upsampleMaterial.needsUpdate = true;

    return this.outputTexture.mul(this.strength);
  }

  dispose() {
    this.prefilterTarget.dispose();
    this.lowTarget.dispose();
    this.outputTarget.dispose();
    this.prefilterMaterial.dispose();
    this.downsampleMaterial.dispose();
    this.upsampleMaterial.dispose();
  }
}
