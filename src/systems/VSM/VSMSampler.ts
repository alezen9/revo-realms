import type {
  Node,
  TextureNode,
  UniformNode,
  WebGPURenderer,
} from "three/webgpu";
import {
  bool,
  cos,
  dFdx,
  dFdy,
  float,
  Fn,
  fract,
  getViewPosition,
  If,
  screenCoordinate,
  screenSize,
  screenUV,
  sin,
  uniform,
  uvec2,
  vec2,
  vec4,
} from "three/tsl";
import type { ScenePass } from "../RendererManager/ScenePass";
import { TexturePass } from "../RendererManager/TexturePass";
import type { VSMContext } from "./VSMContext";
import type { VSMDynamicLayer } from "./VSMDynamicLayer";
import {
  VSM_PAGE_TEXELS,
  getLightPosition,
  getPageCoordinate,
  getPageKey,
  getPageSize,
  getPageTag,
  getReceiverLevel,
} from "./VSMMath";
import type { VSMStaticCache } from "./VSMStaticCache";

type FloatNode = Node<"float">;
type Vec2Node = Node<"vec2">;
type Vec4Node = Node<"vec4">;
type FloatUniform = UniformNode<"float", number>;

export type VSMDepthLayer = {
  readonly minimumY: FloatUniform;
  readonly maximumY: FloatUniform;
  readonly isReady: FloatUniform;
  readonly depthBiasTexels: number;
  loadDepth: (slot: Node<"uint">, texel: Node<"uvec2">) => FloatNode;
  compareDepth: (
    slot: Node<"uint">,
    pageUv: Vec2Node,
    receiverDepth: FloatNode,
  ) => FloatNode;
};

type SampledLayers = {
  staticCache?: VSMStaticCache;
  dynamicLayer?: VSMDynamicLayer;
};

type Receiver = {
  worldY: FloatNode;
  texelMeters: FloatNode;
  heightPerPage: Vec2Node;
};

type PageLookup = {
  coordinate: Node<"uvec2">;
  slot: Node<"uint">;
  isResident: Node<"bool">;
  hasDynamic: Node<"bool">;
  dynamicSlot: Node<"uint">;
};

type SoftSampleArgs = [
  softSample: Vec4Node,
  bilinearWeight: FloatNode,
  viewDistance: FloatNode,
];

type SoftUpsampleArgs = [
  softVisibility: TextureNode,
  softVisibilitySize: Vec2Node,
  uv: Vec2Node,
  viewDistance: FloatNode,
];

const PENUMBRA_TAP_COUNT = 8;
const TENT_RADIUS_TEXELS = 0.51;
const SOFT_TAP_DIRECTIONS = [
  vec2(-0.5, -0.5),
  vec2(0.5, -0.5),
  vec2(-0.5, 0.5),
  vec2(0.5, 0.5),
];
const BLOCKER_DIRECTIONS = [
  vec2(0, 0),
  vec2(-1, -1),
  vec2(1, -1),
  vec2(-1, 1),
  vec2(1, 1),
];
const MAX_RECEIVER_SLOPE = 4;
const GOLDEN_ANGLE = 2.399963;
const SOFT_VISIBILITY_SCALE = 0.5;
const SOFT_DEPTH_SHARPNESS = 64;

const getReceiverSlope = (lightPosition: Vec2Node, worldHeight: FloatNode) => {
  const lightDx = dFdx(lightPosition);
  const lightDy = dFdy(lightPosition);
  const heightDx = dFdx(worldHeight);
  const heightDy = dFdy(worldHeight);
  const determinant = lightDx.x.mul(lightDy.y).sub(lightDx.y.mul(lightDy.x));
  const slope = vec2(
    heightDx.mul(lightDy.y).sub(heightDy.mul(lightDx.y)),
    lightDx.x.mul(heightDy).sub(lightDy.x.mul(heightDx)),
  ).div(determinant.abs().max(1e-12).mul(determinant.sign()));
  return determinant
    .abs()
    .greaterThan(1e-12)
    .select(
      slope.mul(
        float(MAX_RECEIVER_SLOPE).div(slope.length().max(MAX_RECEIVER_SLOPE)),
      ),
      vec2(0),
    );
};

const getInterleavedGradientNoise = (pixel: Vec2Node) =>
  fract(pixel.dot(vec2(0.06711056, 0.00583715)).fract().mul(52.9829189));

const weighSoftSample = Fn<SoftSampleArgs, Vec2Node>(
  ([softSample, bilinearWeight, viewDistance]) => {
    const relativeDistance = softSample.y
      .sub(viewDistance)
      .abs()
      .div(viewDistance.max(0.001));
    const depthWeight = float(1).div(
      relativeDistance.mul(SOFT_DEPTH_SHARPNESS).add(1),
    );
    const weight = bilinearWeight.mul(depthWeight).max(0.0001);
    return vec2(softSample.x.mul(weight), weight);
  },
);

const upsampleSoftVisibility = Fn<SoftUpsampleArgs, FloatNode>(
  ([softVisibility, softVisibilitySize, uv, viewDistance]) => {
    const texelPosition = uv.mul(softVisibilitySize).sub(0.5);
    const baseTexel = texelPosition.floor();
    const blend = texelPosition.sub(baseTexel);
    const inverseBlend = vec2(1).sub(blend);
    const topLeftUv = baseTexel.add(vec2(0.5, 0.5)).div(softVisibilitySize);
    const topRightUv = baseTexel.add(vec2(1.5, 0.5)).div(softVisibilitySize);
    const bottomLeftUv = baseTexel.add(vec2(0.5, 1.5)).div(softVisibilitySize);
    const bottomRightUv = baseTexel.add(vec2(1.5, 1.5)).div(softVisibilitySize);
    const topLeft = weighSoftSample(
      softVisibility.sample(topLeftUv),
      inverseBlend.x.mul(inverseBlend.y),
      viewDistance,
    );
    const topRight = weighSoftSample(
      softVisibility.sample(topRightUv),
      blend.x.mul(inverseBlend.y),
      viewDistance,
    );
    const bottomLeft = weighSoftSample(
      softVisibility.sample(bottomLeftUv),
      inverseBlend.x.mul(blend.y),
      viewDistance,
    );
    const bottomRight = weighSoftSample(
      softVisibility.sample(bottomRightUv),
      blend.x.mul(blend.y),
      viewDistance,
    );
    const weightedSum = topLeft.add(topRight).add(bottomLeft).add(bottomRight);
    return weightedSum.x.div(weightedSum.y);
  },
);

export class VSMSampler {
  readonly filter = {
    softness: uniform(0.5),
    lightSize: uniform(0.02),
    maxSoftness: uniform(4.5),
  };
  private context: VSMContext;
  private scene: ScenePass;
  private staticCache: VSMStaticCache;
  private dynamicLayer: VSMDynamicLayer;
  private softVisibilityPass: TexturePass;
  private softVisibility: TextureNode;
  private softVisibilitySize: Node<"vec2">;

  constructor(
    renderer: WebGPURenderer,
    context: VSMContext,
    scene: ScenePass,
    staticCache: VSMStaticCache,
    dynamicLayer: VSMDynamicLayer,
  ) {
    this.context = context;
    this.scene = scene;
    this.staticCache = staticCache;
    this.dynamicLayer = dynamicLayer;
    this.softVisibilityPass = new TexturePass(
      renderer,
      "Soft shadow visibility",
      SOFT_VISIBILITY_SCALE,
    );
    this.softVisibilitySize = uniform(this.softVisibilityPass.size);
    const representativeUv = screenUV.sub(vec2(0.25).div(screenSize));
    this.softVisibility = this.softVisibilityPass.apply(
      this.resolveSoftVisibility(representativeUv),
    );
  }

  render() {
    this.softVisibilityPass.render();
  }

  resolveVisibility = Fn<[uv: Vec2Node], FloatNode>(([uv]) => {
    const { depth, worldPosition, viewDistance } = this.getReceiver(uv);
    const receiverDepth = depth.toVar();
    const receiverWorldPosition = worldPosition.toVar();
    const receiverViewDistance = viewDistance.toVar();
    const visibility = float(1).toVar();
    If(this.isSoftReceiver(uv), () => {
      visibility.assign(
        upsampleSoftVisibility(
          this.softVisibility,
          this.softVisibilitySize,
          uv,
          receiverViewDistance,
        ),
      );
    }).Else(() => {
      visibility.assign(
        this.computeVisibility(
          receiverWorldPosition,
          receiverDepth,
          receiverViewDistance,
          bool(false),
          { staticCache: this.staticCache, dynamicLayer: this.dynamicLayer },
        ),
      );
    });
    return visibility;
  });

  resolveStaticVisibility = Fn<[uv: Vec2Node], FloatNode>(([uv]) => {
    const { depth, worldPosition, viewDistance } = this.getReceiver(uv);
    return this.computeVisibility(
      worldPosition,
      depth,
      viewDistance,
      this.isSoftReceiver(uv),
      { staticCache: this.staticCache },
    );
  });

  resolveDynamicVisibility = Fn<[uv: Vec2Node], FloatNode>(([uv]) => {
    const { depth, worldPosition, viewDistance } = this.getReceiver(uv);
    return this.computeVisibility(
      worldPosition,
      depth,
      viewDistance,
      this.isSoftReceiver(uv),
      { dynamicLayer: this.dynamicLayer },
    );
  });

  private resolveSoftVisibility = Fn<[uv: Vec2Node], Vec4Node>(([uv]) => {
    const { depth, worldPosition, viewDistance } = this.getReceiver(uv);
    const visibility = this.computeVisibility(
      worldPosition,
      depth,
      viewDistance,
      bool(true),
      { staticCache: this.staticCache, dynamicLayer: this.dynamicLayer },
    );
    return vec4(visibility, viewDistance, 0, 1);
  });

  getReceiver(uv: Vec2Node) {
    const depth = this.scene.depth.sample(uv).r;
    const viewPosition = getViewPosition(
      uv,
      depth,
      this.context.projectionMatrixInverse,
    );
    const worldPosition = this.context.cameraWorldMatrix.mul(
      vec4(viewPosition, 1),
    ).xyz;
    return { depth, worldPosition, viewDistance: viewPosition.length() };
  }

  isSoftReceiver(uv: Vec2Node) {
    return this.scene.softShadow.sample(uv).r.greaterThan(0.5);
  }

  private computeVisibility(
    worldPosition: Node<"vec3">,
    sceneDepth: FloatNode,
    viewDistance: FloatNode,
    isSoftReceiver: Node<"bool">,
    layers: SampledLayers,
  ) {
    const { staticCache, dynamicLayer } = layers;
    const { sunDirection } = this.context;
    const level = getReceiverLevel(viewDistance, isSoftReceiver).toVar();
    const pageSize = getPageSize(level).toVar();
    const lightPosition = getLightPosition(worldPosition, sunDirection).toVar();
    const pagePosition = lightPosition.div(pageSize).toVar();
    const receiver = {
      worldY: worldPosition.y.toVar(),
      texelMeters: getPageSize(getReceiverLevel(viewDistance, bool(false)))
        .div(VSM_PAGE_TEXELS)
        .toVar(),
      heightPerPage: isSoftReceiver
        .select(
          vec2(0),
          getReceiverSlope(lightPosition, worldPosition.y).mul(pageSize),
        )
        .toVar(),
    };
    const readyLayer = staticCache ?? dynamicLayer;
    const isReady = readyLayer
      ? readyLayer.isReady.greaterThan(0)
      : bool(false);
    const isInside = isReady
      .and(sceneDepth.lessThan(1))
      .and(sunDirection.y.lessThan(-0.25));
    const visibility = float(1).toVar();
    If(isInside, () => {
      const centerPage = this.lookupPage(
        getPageCoordinate(pagePosition),
        level,
      );
      const visibilitySum = float(0).toVar();
      const weight = float(0).toVar();
      const tentOrigin = pagePosition
        .fract()
        .mul(VSM_PAGE_TEXELS)
        .sub(1)
        .floor();
      const isTentAvailable = tentOrigin.x
        .greaterThanEqual(0)
        .and(tentOrigin.y.greaterThanEqual(0))
        .and(tentOrigin.x.lessThanEqual(VSM_PAGE_TEXELS - 3))
        .and(tentOrigin.y.lessThanEqual(VSM_PAGE_TEXELS - 3))
        .and(staticCache ? centerPage.isResident : bool(false))
        .toVar();
      If(isSoftReceiver, () => {
        If(isTentAvailable, () => {
          visibilitySum.assign(
            this.sampleTent(pagePosition, centerPage, receiver, layers),
          );
          weight.assign(1);
        }).Else(() => {
          for (const direction of SOFT_TAP_DIRECTIONS) {
            const tap = this.sampleTap(
              pagePosition,
              direction.div(VSM_PAGE_TEXELS),
              level,
              centerPage,
              receiver,
              layers,
            );
            visibilitySum.addAssign(tap.visibility);
            weight.addAssign(tap.weight);
          }
        });
      }).Else(() => {
        const radius = this.computePenumbraTexels(
          pagePosition,
          centerPage,
          receiver,
          layers,
        );
        If(
          isTentAvailable.and(radius.lessThanEqual(TENT_RADIUS_TEXELS)),
          () => {
            visibilitySum.assign(
              this.sampleTent(pagePosition, centerPage, receiver, layers),
            );
            weight.assign(1);
          },
        ).Else(() => {
          const rotation = getInterleavedGradientNoise(screenCoordinate.xy).mul(
            Math.PI * 2,
          );
          for (let tapIndex = 0; tapIndex < PENUMBRA_TAP_COUNT; tapIndex++) {
            const angle = rotation.add(tapIndex * GOLDEN_ANGLE);
            const offset = vec2(cos(angle), sin(angle)).mul(
              radius.mul(Math.sqrt((tapIndex + 0.5) / PENUMBRA_TAP_COUNT)),
            );
            const tap = this.sampleTap(
              pagePosition,
              offset.div(VSM_PAGE_TEXELS),
              level,
              centerPage,
              receiver,
              layers,
            );
            visibilitySum.addAssign(tap.visibility);
            weight.addAssign(tap.weight);
          }
        });
      });
      If(weight.greaterThan(0), () => {
        visibility.assign(visibilitySum.div(weight));
      });
    });
    return visibility;
  }

  private lookupPage(
    pageCoordinate: Node<"uvec2">,
    level: Node<"uint">,
  ): PageLookup {
    const page = this.context.resolvePage(
      getPageKey(level, pageCoordinate),
      getPageTag(pageCoordinate),
    );
    return {
      coordinate: pageCoordinate.toVar(),
      slot: page.slot.toVar(),
      isResident: page.isResident.toVar(),
      hasDynamic: page.hasDynamic.toVar(),
      dynamicSlot: page.dynamicSlot.toVar(),
    };
  }

  private sampleTap(
    pagePosition: Vec2Node,
    pageOffset: Vec2Node,
    level: Node<"uint">,
    centerPage: PageLookup,
    receiver: Receiver,
    layers: SampledLayers,
  ) {
    const { staticCache, dynamicLayer } = layers;
    const halfTexel = 0.5 / VSM_PAGE_TEXELS;
    const tapPosition = pagePosition.add(pageOffset).toVar();
    const pageCoordinate = getPageCoordinate(tapPosition).toVar();
    const slot = centerPage.slot.toVar();
    const isResident = centerPage.isResident.toVar();
    const hasDynamic = centerPage.hasDynamic.toVar();
    const dynamicSlot = centerPage.dynamicSlot.toVar();
    If(
      pageCoordinate.x
        .notEqual(centerPage.coordinate.x)
        .or(pageCoordinate.y.notEqual(centerPage.coordinate.y)),
      () => {
        const page = this.context.resolvePage(
          getPageKey(level, pageCoordinate),
          getPageTag(pageCoordinate),
        );
        slot.assign(page.slot);
        isResident.assign(page.isResident);
        hasDynamic.assign(page.hasDynamic);
        dynamicSlot.assign(page.dynamicSlot);
      },
    );
    const pageUv = tapPosition.fract().clamp(halfTexel, 1 - halfTexel);
    const visibility = float(1).toVar();
    if (staticCache)
      visibility.assign(
        this.sampleDepth(staticCache, slot, pageUv, pageOffset, receiver),
      );
    if (dynamicLayer)
      If(hasDynamic, () => {
        visibility.mulAssign(
          this.sampleDepth(
            dynamicLayer,
            dynamicSlot,
            pageUv,
            pageOffset,
            receiver,
          ),
        );
      });
    const isSampled = staticCache ? isResident : hasDynamic;
    const weight = isSampled.select(float(1), float(0));
    return { visibility: visibility.mul(weight), weight };
  }

  private computePenumbraTexels(
    pagePosition: Vec2Node,
    centerPage: PageLookup,
    receiver: Receiver,
    layers: SampledLayers,
  ) {
    const { staticCache, dynamicLayer } = layers;
    const pageUv = pagePosition.fract();
    const heightSum = float(0).toVar();
    const count = float(0).toVar();
    if (staticCache)
      If(centerPage.isResident, () => {
        const blockers = this.searchBlockers(
          staticCache,
          centerPage.slot,
          pageUv,
          receiver,
        );
        heightSum.addAssign(blockers.heightSum);
        count.addAssign(blockers.count);
      });
    if (dynamicLayer)
      If(centerPage.hasDynamic, () => {
        const blockers = this.searchBlockers(
          dynamicLayer,
          centerPage.dynamicSlot,
          pageUv,
          receiver,
        );
        heightSum.addAssign(blockers.heightSum);
        count.addAssign(blockers.count);
      });
    const { filter } = this;
    const rayDistance = heightSum
      .div(count.max(1))
      .div(this.context.sunDirection.y.abs().max(0.25));
    return rayDistance
      .mul(filter.lightSize)
      .div(receiver.texelMeters)
      .clamp(filter.softness, filter.maxSoftness)
      .toVar();
  }

  private searchBlockers(
    layer: VSMDepthLayer,
    slot: Node<"uint">,
    pageUv: Vec2Node,
    receiver: Receiver,
  ) {
    const minimumHeight = this.getReceiverBias(layer, receiver).mul(2);
    let heightSum: FloatNode = float(0);
    let count: FloatNode = float(0);
    for (const direction of BLOCKER_DIRECTIONS) {
      const texelOffset = direction.mul(this.filter.maxSoftness);
      const texel = uvec2(
        pageUv
          .mul(VSM_PAGE_TEXELS)
          .add(texelOffset)
          .clamp(0, VSM_PAGE_TEXELS - 1),
      );
      const depth = layer.loadDepth(slot, texel);
      const blockerHeight = layer.maximumY
        .sub(depth.mul(layer.maximumY.sub(layer.minimumY)))
        .sub(
          this.getReceiverHeight(receiver, texelOffset.div(VSM_PAGE_TEXELS)),
        );
      const isBlocker = blockerHeight.greaterThan(minimumHeight);
      heightSum = heightSum.add(isBlocker.select(blockerHeight, float(0)));
      count = count.add(isBlocker.select(float(1), float(0)));
    }
    return { heightSum, count };
  }

  private sampleDepth(
    layer: VSMDepthLayer,
    slot: Node<"uint">,
    pageUv: Vec2Node,
    pageOffset: Vec2Node,
    receiver: Receiver,
  ) {
    const receiverDepth = layer.maximumY
      .sub(this.getReceiverHeight(receiver, pageOffset))
      .sub(this.getReceiverBias(layer, receiver))
      .div(layer.maximumY.sub(layer.minimumY));
    const isInRange = receiver.worldY
      .greaterThanEqual(layer.minimumY)
      .and(receiver.worldY.lessThanEqual(layer.maximumY));
    return isInRange.select(
      layer.compareDepth(slot, pageUv, receiverDepth),
      float(1),
    );
  }

  private sampleTent(
    pagePosition: Vec2Node,
    centerPage: PageLookup,
    receiver: Receiver,
    layers: SampledLayers,
  ) {
    const { staticCache, dynamicLayer } = layers;
    const visibility = float(1).toVar();
    if (staticCache)
      visibility.assign(
        this.sampleStaticTent(
          staticCache,
          centerPage.slot,
          pagePosition.fract(),
          receiver,
        ),
      );
    if (dynamicLayer)
      If(centerPage.hasDynamic, () => {
        const dynamicSum = float(0).toVar();
        for (const direction of SOFT_TAP_DIRECTIONS) {
          const pageOffset = direction.div(VSM_PAGE_TEXELS);
          dynamicSum.addAssign(
            this.sampleDepth(
              dynamicLayer,
              centerPage.dynamicSlot,
              pagePosition.add(pageOffset).fract(),
              pageOffset,
              receiver,
            ),
          );
        }
        visibility.mulAssign(dynamicSum.mul(0.25));
      });
    return visibility;
  }

  private sampleStaticTent(
    staticCache: VSMStaticCache,
    slot: Node<"uint">,
    pageUv: Vec2Node,
    receiver: Receiver,
  ) {
    const depthRange = staticCache.maximumY.sub(staticCache.minimumY);
    const receiverDepth = staticCache.maximumY
      .sub(receiver.worldY)
      .sub(this.getReceiverBias(staticCache, receiver))
      .div(depthRange);
    const isInRange = receiver.worldY
      .greaterThanEqual(staticCache.minimumY)
      .and(receiver.worldY.lessThanEqual(staticCache.maximumY));
    return isInRange.select(
      staticCache.compareDepthTent(
        slot,
        pageUv,
        receiverDepth,
        receiver.heightPerPage.negate().div(depthRange),
      ),
      float(1),
    );
  }

  private getReceiverHeight(receiver: Receiver, pageOffset: Vec2Node) {
    return receiver.worldY.add(receiver.heightPerPage.dot(pageOffset));
  }

  private getReceiverBias(layer: VSMDepthLayer, receiver: Receiver) {
    return receiver.texelMeters
      .mul(layer.depthBiasTexels)
      .add(receiver.heightPerPage.length().div(VSM_PAGE_TEXELS));
  }
}
