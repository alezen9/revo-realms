import type {
  Node,
  TextureNode,
  UniformNode,
  WebGPURenderer,
} from "three/webgpu";
import {
  Fn,
  float,
  luminance,
  screenSize,
  screenUV,
  smoothstep,
  uniform,
  vec2,
  vec4,
} from "three/tsl";
import type { DebugFolder } from "../DebugManager";
import { TexturePass } from "./TexturePass";

type FloatNode = Node<"float">;
type Vec2Node = Node<"vec2">;
type Vec4Node = Node<"vec4">;
type FloatUniform = UniformNode<"float", number>;

type BloomOptions = {
  strength: number;
  threshold: number;
  smoothWidth: number;
  spread: number;
};

type KarisGroupArgs = [
  first: Vec4Node,
  second: Vec4Node,
  third: Vec4Node,
  fourth: Vec4Node,
  groupWeight: FloatNode,
];

type HighlightArgs = [
  input: TextureNode,
  uv: Vec2Node,
  threshold: FloatNode,
  smoothWidth: FloatNode,
];

type PrefilterArgs = [
  input: TextureNode,
  uv: Vec2Node,
  texelSize: Vec2Node,
  threshold: FloatNode,
  smoothWidth: FloatNode,
];

type DownsampleArgs = [input: TextureNode, uv: Vec2Node, texelSize: Vec2Node];

type UpsampleArgs = [
  input: TextureNode,
  uv: Vec2Node,
  texelSize: Vec2Node,
  spread: FloatNode,
];

const PREFILTER_SCALE = 0.5;
const DOWNSAMPLE_SCALE = 0.25;

const weighKarisGroup = Fn<KarisGroupArgs, Vec4Node>(
  ([first, second, third, fourth, groupWeight]) => {
    const average = first.add(second).add(third).add(fourth).mul(0.25);
    const karisWeight = float(1).div(luminance(average.rgb).add(1));
    const weight = groupWeight.mul(karisWeight);
    return vec4(average.rgb.mul(weight), weight);
  },
);

const sampleHighlight = Fn<HighlightArgs, Vec4Node>(
  ([input, uv, threshold, smoothWidth]) => {
    const color = input.sample(uv);
    const brightness = smoothstep(
      threshold,
      threshold.add(smoothWidth),
      luminance(color.rgb),
    );
    return color.mul(brightness);
  },
);

const prefilter = Fn<PrefilterArgs, Vec4Node>(
  ([input, uv, texelSize, threshold, smoothWidth]) => {
    const topLeftUv = uv.add(texelSize.mul(vec2(-2, -2)));
    const topUv = uv.add(texelSize.mul(vec2(0, -2)));
    const topRightUv = uv.add(texelSize.mul(vec2(2, -2)));
    const leftUv = uv.add(texelSize.mul(vec2(-2, 0)));
    const rightUv = uv.add(texelSize.mul(vec2(2, 0)));
    const bottomLeftUv = uv.add(texelSize.mul(vec2(-2, 2)));
    const bottomUv = uv.add(texelSize.mul(vec2(0, 2)));
    const bottomRightUv = uv.add(texelSize.mul(vec2(2, 2)));
    const innerTopLeftUv = uv.add(texelSize.mul(vec2(-1, -1)));
    const innerTopRightUv = uv.add(texelSize.mul(vec2(1, -1)));
    const innerBottomLeftUv = uv.add(texelSize.mul(vec2(-1, 1)));
    const innerBottomRightUv = uv.add(texelSize.mul(vec2(1, 1)));

    const topLeft = sampleHighlight(input, topLeftUv, threshold, smoothWidth);
    const top = sampleHighlight(input, topUv, threshold, smoothWidth);
    const topRight = sampleHighlight(input, topRightUv, threshold, smoothWidth);
    const left = sampleHighlight(input, leftUv, threshold, smoothWidth);
    const center = sampleHighlight(input, uv, threshold, smoothWidth);
    const right = sampleHighlight(input, rightUv, threshold, smoothWidth);
    const bottomLeft = sampleHighlight(
      input,
      bottomLeftUv,
      threshold,
      smoothWidth,
    );
    const bottom = sampleHighlight(input, bottomUv, threshold, smoothWidth);
    const bottomRight = sampleHighlight(
      input,
      bottomRightUv,
      threshold,
      smoothWidth,
    );
    const innerTopLeft = sampleHighlight(
      input,
      innerTopLeftUv,
      threshold,
      smoothWidth,
    );
    const innerTopRight = sampleHighlight(
      input,
      innerTopRightUv,
      threshold,
      smoothWidth,
    );
    const innerBottomLeft = sampleHighlight(
      input,
      innerBottomLeftUv,
      threshold,
      smoothWidth,
    );
    const innerBottomRight = sampleHighlight(
      input,
      innerBottomRightUv,
      threshold,
      smoothWidth,
    );

    const innerGroup = weighKarisGroup(
      innerTopLeft,
      innerTopRight,
      innerBottomLeft,
      innerBottomRight,
      float(0.5),
    );
    const topLeftGroup = weighKarisGroup(
      topLeft,
      top,
      left,
      center,
      float(0.125),
    );
    const topRightGroup = weighKarisGroup(
      top,
      topRight,
      center,
      right,
      float(0.125),
    );
    const bottomLeftGroup = weighKarisGroup(
      left,
      center,
      bottomLeft,
      bottom,
      float(0.125),
    );
    const bottomRightGroup = weighKarisGroup(
      center,
      right,
      bottom,
      bottomRight,
      float(0.125),
    );

    const weightedColor = innerGroup.rgb
      .add(topLeftGroup.rgb)
      .add(topRightGroup.rgb)
      .add(bottomLeftGroup.rgb)
      .add(bottomRightGroup.rgb);
    const weightSum = innerGroup.a
      .add(topLeftGroup.a)
      .add(topRightGroup.a)
      .add(bottomLeftGroup.a)
      .add(bottomRightGroup.a);
    return vec4(weightedColor.div(weightSum), 1);
  },
);

const downsample = Fn<DownsampleArgs, Vec4Node>(([input, uv, texelSize]) => {
  const center = input.sample(uv);
  const topLeft = input.sample(uv.add(texelSize.mul(vec2(-1, -1))));
  const topRight = input.sample(uv.add(texelSize.mul(vec2(1, -1))));
  const bottomLeft = input.sample(uv.add(texelSize.mul(vec2(-1, 1))));
  const bottomRight = input.sample(uv.add(texelSize.mul(vec2(1, 1))));
  const cornerSum = topLeft.add(topRight).add(bottomLeft).add(bottomRight);
  return center.mul(4).add(cornerSum).div(8);
});

const upsample = Fn<UpsampleArgs, Vec4Node>(
  ([input, uv, texelSize, spread]) => {
    const edgeOffset = texelSize.mul(spread);
    const diagonalOffset = edgeOffset.mul(0.5);
    const left = input.sample(uv.add(edgeOffset.mul(vec2(-1, 0))));
    const right = input.sample(uv.add(edgeOffset.mul(vec2(1, 0))));
    const top = input.sample(uv.add(edgeOffset.mul(vec2(0, -1))));
    const bottom = input.sample(uv.add(edgeOffset.mul(vec2(0, 1))));
    const topLeft = input.sample(uv.add(diagonalOffset.mul(vec2(-1, -1))));
    const topRight = input.sample(uv.add(diagonalOffset.mul(vec2(1, -1))));
    const bottomLeft = input.sample(uv.add(diagonalOffset.mul(vec2(-1, 1))));
    const bottomRight = input.sample(uv.add(diagonalOffset.mul(vec2(1, 1))));
    const edgeSum = left.add(right).add(top).add(bottom);
    const diagonalSum = topLeft.add(topRight).add(bottomLeft).add(bottomRight);
    return edgeSum.add(diagonalSum.mul(2)).div(12);
  },
);

const getSourceTexelSize = (sourceScale: number, targetScale: number) =>
  vec2(targetScale / sourceScale).div(screenSize);

export class DualKawaseBloomPass {
  readonly strength: FloatUniform;
  readonly threshold: FloatUniform;
  readonly smoothWidth: FloatUniform;
  readonly spread: FloatUniform;
  private prefilterPass: TexturePass;
  private downsamplePass: TexturePass;
  private upsamplePass: TexturePass;

  constructor(renderer: WebGPURenderer, options: BloomOptions) {
    this.strength = uniform(options.strength);
    this.threshold = uniform(options.threshold);
    this.smoothWidth = uniform(options.smoothWidth);
    this.spread = uniform(options.spread);
    this.prefilterPass = new TexturePass(
      renderer,
      "Bloom prefilter",
      PREFILTER_SCALE,
    );
    this.downsamplePass = new TexturePass(
      renderer,
      "Bloom downsample",
      DOWNSAMPLE_SCALE,
    );
    this.upsamplePass = new TexturePass(
      renderer,
      "Bloom upsample",
      PREFILTER_SCALE,
    );
  }

  apply(input: TextureNode) {
    const prefilterTexelSize = getSourceTexelSize(1, PREFILTER_SCALE);
    const prefiltered = this.prefilterPass.apply(
      prefilter(
        input,
        screenUV,
        prefilterTexelSize,
        this.threshold,
        this.smoothWidth,
      ),
    );

    const downsampleTexelSize = getSourceTexelSize(
      PREFILTER_SCALE,
      DOWNSAMPLE_SCALE,
    );
    const downsampled = this.downsamplePass.apply(
      downsample(prefiltered, screenUV, downsampleTexelSize),
    );

    const upsampleTexelSize = getSourceTexelSize(
      DOWNSAMPLE_SCALE,
      PREFILTER_SCALE,
    );
    const wideGlow = upsample(
      downsampled,
      screenUV,
      upsampleTexelSize,
      this.spread,
    );
    const tightGlow = prefiltered.sample(screenUV);
    const upsampled = this.upsamplePass.apply(tightGlow.add(wideGlow).mul(0.5));

    const glow = upsampled.sample(screenUV).mul(this.strength);
    return input.sample(screenUV).add(glow);
  }

  render() {
    this.prefilterPass.render();
    this.downsamplePass.render();
    this.upsamplePass.render();
  }

  addBindings(folder: DebugFolder) {
    folder.addBinding(this.strength, "value", {
      label: "Bloom strength",
    });
    folder.addBinding(this.threshold, "value", {
      label: "Bloom threshold",
    });
    folder.addBinding(this.smoothWidth, "value", {
      label: "Bloom smooth width",
      min: 0.01,
      max: 1,
      step: 0.01,
    });
    folder.addBinding(this.spread, "value", {
      label: "Bloom spread",
      min: 1,
      max: 3,
      step: 0.1,
    });
  }
}
