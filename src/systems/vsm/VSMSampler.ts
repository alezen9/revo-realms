import type { Node } from "three/webgpu";
import {
  cos,
  dFdx,
  dFdy,
  float,
  Fn,
  fract,
  getViewPosition,
  If,
  mix,
  screenCoordinate,
  screenSize,
  sin,
  textureLoad,
  uint,
  uniform,
  uvec2,
  vec2,
  vec4,
} from "three/tsl";
import {
  SCENE_PASS_SAMPLES,
  type ScenePass,
} from "../rendering/passes/ScenePass";
import type { VSMContext } from "./VSMContext";
import type { VSMDepthPool } from "./VSMDepthPool";
import {
  VSM_LEVEL_COUNT,
  VSM_PAGE_TEXELS,
  VSM_SOFT_RECEIVER_THRESHOLD,
  getLightPosition,
  getPageCoordinate,
  getPageKey,
  getPageSize,
  getPageTag,
  getReceiverLevel,
  getSoftReceiverLevel,
} from "./VSMMath";

type FloatNode = Node<"float">;
type Vec2Node = Node<"vec2">;

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
const SURFACE_SPLIT_RATIO = 0.01;
const MIN_DETERMINANT = 1e-12;
const NOISE_WEIGHTS = vec2(0.06711056, 0.00583715);
const NOISE_SCALE = 52.9829189;

const getReceiverSlope = (lightPosition: Vec2Node, worldHeight: FloatNode) => {
  const lightDx = dFdx(lightPosition);
  const lightDy = dFdy(lightPosition);
  const heightDx = dFdx(worldHeight);
  const heightDy = dFdy(worldHeight);
  const determinant = lightDx.x.mul(lightDy.y).sub(lightDx.y.mul(lightDy.x));
  const determinantSize = determinant.abs();
  const safeDeterminant = determinantSize
    .max(MIN_DETERMINANT)
    .mul(determinant.sign());
  const slopeX = heightDx.mul(lightDy.y).sub(heightDy.mul(lightDx.y));
  const slopeY = lightDx.x.mul(heightDy).sub(lightDy.x.mul(heightDx));
  const slope = vec2(slopeX, slopeY).div(safeDeterminant);
  const slopeLength = slope.length().max(MAX_RECEIVER_SLOPE);
  const slopeScale = float(MAX_RECEIVER_SLOPE).div(slopeLength);
  const clampedSlope = slope.mul(slopeScale);
  const hasSlope = determinantSize.greaterThan(MIN_DETERMINANT);
  return hasSlope.select(clampedSlope, vec2(0));
};

const getInterleavedGradientNoise = (pixel: Vec2Node) => {
  const pixelHash = pixel.dot(NOISE_WEIGHTS).fract();
  return fract(pixelHash.mul(NOISE_SCALE));
};

const getDitheredSoftLevel = (viewDistance: FloatNode, softness: FloatNode) => {
  const softLevel = getSoftReceiverLevel(viewDistance, softness);
  const noise = getInterleavedGradientNoise(screenCoordinate.xy);
  const ditheredLevel = softLevel.add(noise).floor();
  return uint(ditheredLevel.min(VSM_LEVEL_COUNT - 1));
};

export class VSMSampler {
  readonly filter = {
    softness: uniform(0.5),
    lightSize: uniform(0.02),
    maxSoftness: uniform(4.5),
  };
  private context: VSMContext;
  private scene: ScenePass;
  private staticPool: VSMDepthPool;
  private dynamicPool: VSMDepthPool;

  constructor(
    context: VSMContext,
    scene: ScenePass,
    staticPool: VSMDepthPool,
    dynamicPool: VSMDepthPool,
  ) {
    this.context = context;
    this.scene = scene;
    this.staticPool = staticPool;
    this.dynamicPool = dynamicPool;
  }

  resolveVisibility = Fn<[uv: Vec2Node], FloatNode>(([uv]) => {
    const { depth, worldPosition, viewDistance } = this.getReceiver(uv);
    const receiverDepth = depth.toVar();
    const receiverWorldPosition = worldPosition.toVar();
    const receiverViewDistance = viewDistance.toVar();
    const softness = this.getSoftness(uv).toVar();
    const visibility = float(1).toVar();
    If(softness.greaterThan(VSM_SOFT_RECEIVER_THRESHOLD), () => {
      visibility.assign(this.resolveSoftSurfaces(uv, softness));
    }).Else(() => {
      visibility.assign(
        this.computeVisibility(
          receiverWorldPosition,
          receiverDepth,
          receiverViewDistance,
          getReceiverLevel(receiverViewDistance),
          false,
        ),
      );
    });
    return visibility;
  });

  private resolveSoftSurfaces(uv: Vec2Node, softness: FloatNode) {
    const pixel = uvec2(uv.mul(screenSize).floor()).toVar();
    const depths: FloatNode[] = [];
    for (let sampleIndex = 0; sampleIndex < SCENE_PASS_SAMPLES; sampleIndex++) {
      const sample = textureLoad(this.scene.depth, pixel).level(
        uint(sampleIndex),
      );
      depths.push(sample.r.toVar());
    }
    let nearestDepth = depths[0];
    let farthestDepth = depths[0];
    for (const depth of depths) {
      nearestDepth = nearestDepth.min(depth);
      farthestDepth = farthestDepth.max(depth);
    }
    const nearDepth = nearestDepth.toVar();
    const farDepth = farthestDepth.toVar();
    const near = this.getReceiverAtDepth(uv, nearDepth);
    const far = this.getReceiverAtDepth(uv, farDepth);
    const nearWorldPosition = near.worldPosition.toVar();
    const nearViewDistance = near.viewDistance.toVar();
    const farWorldPosition = far.worldPosition.toVar();
    const farViewDistance = far.viewDistance.toVar();
    const middleDepth = nearDepth.add(farDepth).mul(0.5);
    let farCount: FloatNode = float(0);
    for (const depth of depths)
      farCount = farCount.add(float(depth.greaterThan(middleDepth)));
    const farCoverage = farCount.div(SCENE_PASS_SAMPLES).toVar();
    const visibility = this.computeVisibility(
      nearWorldPosition,
      nearDepth,
      nearViewDistance,
      getDitheredSoftLevel(nearViewDistance, softness),
      true,
    ).toVar();
    const surfaceGap = farViewDistance.sub(nearViewDistance);
    const hasFarSurface = surfaceGap.greaterThan(
      nearViewDistance.mul(SURFACE_SPLIT_RATIO),
    );
    If(hasFarSurface, () => {
      const farVisibility = this.computeVisibility(
        farWorldPosition,
        farDepth,
        farViewDistance,
        getDitheredSoftLevel(farViewDistance, softness),
        true,
      );
      visibility.assign(mix(visibility, farVisibility, farCoverage));
    });
    return visibility;
  }

  getReceiver(uv: Vec2Node) {
    return this.getReceiverAtDepth(uv, this.scene.depth.sample(uv).r);
  }

  private getReceiverAtDepth(uv: Vec2Node, depth: FloatNode) {
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

  getSoftness(uv: Vec2Node) {
    return this.scene.softShadow.sample(uv).r;
  }

  private computeVisibility(
    worldPosition: Node<"vec3">,
    sceneDepth: FloatNode,
    viewDistance: FloatNode,
    receiverLevel: Node<"uint">,
    isSoftReceiver: boolean,
  ) {
    const { sunDirection } = this.context;
    const level = receiverLevel.toVar();
    const pageSize = getPageSize(level).toVar();
    const lightPosition = getLightPosition(
      worldPosition,
      this.context.lightBasis,
    ).toVar();
    const pagePosition = lightPosition.div(pageSize).toVar();
    let heightPerPage: Vec2Node = vec2(0);
    if (!isSoftReceiver)
      heightPerPage = getReceiverSlope(lightPosition, worldPosition.y).mul(
        pageSize,
      );
    const receiverPageSize = getPageSize(getReceiverLevel(viewDistance));
    const receiver = {
      worldY: worldPosition.y.toVar(),
      texelMeters: receiverPageSize.div(VSM_PAGE_TEXELS).toVar(),
      heightPerPage: heightPerPage.toVar(),
    };
    const isShadowReady = this.staticPool.isReady.greaterThan(0);
    const isSurface = sceneDepth.lessThan(1);
    const isSunUp = sunDirection.y.lessThan(-0.25);
    const isInside = isShadowReady.and(isSurface).and(isSunUp);
    const visibility = float(1).toVar();
    If(isInside, () => {
      const centerPage = this.lookupPage(
        getPageCoordinate(pagePosition),
        level,
      );
      const visibilitySum = float(0).toVar();
      const weight = float(0).toVar();
      const pageTexelPosition = pagePosition.fract().mul(VSM_PAGE_TEXELS);
      const tentOrigin = pageTexelPosition.sub(1).floor();
      const tentMinimum = tentOrigin.x.min(tentOrigin.y);
      const tentMaximum = tentOrigin.x.max(tentOrigin.y);
      const isTentInsidePage = tentMinimum
        .greaterThanEqual(0)
        .and(tentMaximum.lessThanEqual(VSM_PAGE_TEXELS - 3));
      const isTentAvailable = isTentInsidePage
        .and(centerPage.isResident)
        .toVar();
      if (isSoftReceiver) {
        If(isTentAvailable, () => {
          visibilitySum.assign(
            this.sampleTent(pagePosition, centerPage, receiver),
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
            );
            visibilitySum.addAssign(tap.visibility);
            weight.addAssign(tap.weight);
          }
        });
      } else {
        const radius = this.computePenumbraTexels(
          pagePosition,
          centerPage,
          receiver,
        );
        const isSharpPenumbra = radius.lessThanEqual(TENT_RADIUS_TEXELS);
        If(isTentAvailable.and(isSharpPenumbra), () => {
          visibilitySum.assign(
            this.sampleTent(pagePosition, centerPage, receiver),
          );
          weight.assign(1);
        }).Else(() => {
          const rotation = getInterleavedGradientNoise(screenCoordinate.xy).mul(
            Math.PI * 2,
          );
          for (let tapIndex = 0; tapIndex < PENUMBRA_TAP_COUNT; tapIndex++) {
            const angle = rotation.add(tapIndex * GOLDEN_ANGLE);
            const tapRatio = Math.sqrt((tapIndex + 0.5) / PENUMBRA_TAP_COUNT);
            const tapDistance = radius.mul(tapRatio);
            const offset = vec2(cos(angle), sin(angle)).mul(tapDistance);
            const tap = this.sampleTap(
              pagePosition,
              offset.div(VSM_PAGE_TEXELS),
              level,
              centerPage,
              receiver,
            );
            visibilitySum.addAssign(tap.visibility);
            weight.addAssign(tap.weight);
          }
        });
      }
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
  ) {
    const halfTexel = 0.5 / VSM_PAGE_TEXELS;
    const tapPosition = pagePosition.add(pageOffset).toVar();
    const pageCoordinate = getPageCoordinate(tapPosition).toVar();
    const slot = centerPage.slot.toVar();
    const isResident = centerPage.isResident.toVar();
    const hasDynamic = centerPage.hasDynamic.toVar();
    const dynamicSlot = centerPage.dynamicSlot.toVar();
    const isOtherPageX = pageCoordinate.x.notEqual(centerPage.coordinate.x);
    const isOtherPageY = pageCoordinate.y.notEqual(centerPage.coordinate.y);
    If(isOtherPageX.or(isOtherPageY), () => {
      const page = this.context.resolvePage(
        getPageKey(level, pageCoordinate),
        getPageTag(pageCoordinate),
      );
      slot.assign(page.slot);
      isResident.assign(page.isResident);
      hasDynamic.assign(page.hasDynamic);
      dynamicSlot.assign(page.dynamicSlot);
    });
    const pageUv = tapPosition.fract().clamp(halfTexel, 1 - halfTexel);
    const visibility = this.sampleDepth(
      this.staticPool,
      slot,
      pageUv,
      pageOffset,
      receiver,
    ).toVar();
    If(hasDynamic, () => {
      visibility.mulAssign(
        this.sampleDepth(
          this.dynamicPool,
          dynamicSlot,
          pageUv,
          pageOffset,
          receiver,
        ),
      );
    });
    const weight = float(isResident);
    return { visibility: visibility.mul(weight), weight };
  }

  private computePenumbraTexels(
    pagePosition: Vec2Node,
    centerPage: PageLookup,
    receiver: Receiver,
  ) {
    const pageUv = pagePosition.fract();
    const heightSum = float(0).toVar();
    const count = float(0).toVar();
    If(centerPage.isResident, () => {
      const blockers = this.searchBlockers(
        this.staticPool,
        centerPage.slot,
        pageUv,
        receiver,
      );
      heightSum.addAssign(blockers.heightSum);
      count.addAssign(blockers.count);
    });
    If(centerPage.hasDynamic, () => {
      const blockers = this.searchBlockers(
        this.dynamicPool,
        centerPage.dynamicSlot,
        pageUv,
        receiver,
      );
      heightSum.addAssign(blockers.heightSum);
      count.addAssign(blockers.count);
    });
    const { filter } = this;
    const averageBlockerHeight = heightSum.div(count.max(1));
    const sunHeight = this.context.sunDirection.y.abs().max(0.25);
    const rayDistance = averageBlockerHeight.div(sunHeight);
    const penumbraMeters = rayDistance.mul(filter.lightSize);
    const penumbraTexels = penumbraMeters.div(receiver.texelMeters);
    return penumbraTexels.clamp(filter.softness, filter.maxSoftness).toVar();
  }

  private searchBlockers(
    layer: VSMDepthPool,
    slot: Node<"uint">,
    pageUv: Vec2Node,
    receiver: Receiver,
  ) {
    const minimumHeight = this.getReceiverBias(layer, receiver).mul(2);
    const depthRange = layer.maximumY.sub(layer.minimumY);
    let heightSum: FloatNode = float(0);
    let count: FloatNode = float(0);
    for (const direction of BLOCKER_DIRECTIONS) {
      const texelOffset = direction.mul(this.filter.maxSoftness);
      const texelPosition = pageUv.mul(VSM_PAGE_TEXELS).add(texelOffset);
      const texel = uvec2(texelPosition.clamp(0, VSM_PAGE_TEXELS - 1));
      const depth = layer.loadDepth(slot, texel);
      const casterHeight = layer.maximumY.sub(depth.mul(depthRange));
      const pageOffset = texelOffset.div(VSM_PAGE_TEXELS);
      const receiverHeight = this.getReceiverHeight(receiver, pageOffset);
      const blockerHeight = casterHeight.sub(receiverHeight);
      const isBlocker = float(blockerHeight.greaterThan(minimumHeight));
      heightSum = heightSum.add(blockerHeight.mul(isBlocker));
      count = count.add(isBlocker);
    }
    return { heightSum, count };
  }

  private sampleDepth(
    layer: VSMDepthPool,
    slot: Node<"uint">,
    pageUv: Vec2Node,
    pageOffset: Vec2Node,
    receiver: Receiver,
  ) {
    const receiverHeight = this.getReceiverHeight(receiver, pageOffset);
    const receiverBias = this.getReceiverBias(layer, receiver);
    const depthRange = layer.maximumY.sub(layer.minimumY);
    const biasedHeight = receiverHeight.add(receiverBias);
    const receiverDepth = layer.maximumY.sub(biasedHeight).div(depthRange);
    const isAboveMinimum = receiver.worldY.greaterThanEqual(layer.minimumY);
    const isBelowMaximum = receiver.worldY.lessThanEqual(layer.maximumY);
    const isInRange = isAboveMinimum.and(isBelowMaximum);
    const layerVisibility = layer.compareDepth(slot, pageUv, receiverDepth);
    return isInRange.select(layerVisibility, float(1));
  }

  private sampleTent(
    pagePosition: Vec2Node,
    centerPage: PageLookup,
    receiver: Receiver,
  ) {
    const pageUv = pagePosition.fract().toVar();
    const visibility = this.sampleLayerTent(
      this.staticPool,
      centerPage.slot,
      pageUv,
      receiver,
    ).toVar();
    If(centerPage.hasDynamic, () => {
      visibility.mulAssign(
        this.sampleLayerTent(
          this.dynamicPool,
          centerPage.dynamicSlot,
          pageUv,
          receiver,
        ),
      );
    });
    return visibility;
  }

  private sampleLayerTent(
    pool: VSMDepthPool,
    slot: Node<"uint">,
    pageUv: Vec2Node,
    receiver: Receiver,
  ) {
    const receiverBias = this.getReceiverBias(pool, receiver);
    const depthRange = pool.maximumY.sub(pool.minimumY);
    const biasedHeight = receiver.worldY.add(receiverBias);
    const receiverDepth = pool.maximumY.sub(biasedHeight).div(depthRange);
    const depthSlope = receiver.heightPerPage.negate().div(depthRange);
    const isAboveMinimum = receiver.worldY.greaterThanEqual(pool.minimumY);
    const isBelowMaximum = receiver.worldY.lessThanEqual(pool.maximumY);
    const isInRange = isAboveMinimum.and(isBelowMaximum);
    const layerVisibility = pool.compareDepthTent(
      slot,
      pageUv,
      receiverDepth,
      depthSlope,
    );
    return isInRange.select(layerVisibility, float(1));
  }

  private getReceiverHeight(receiver: Receiver, pageOffset: Vec2Node) {
    return receiver.worldY.add(receiver.heightPerPage.dot(pageOffset));
  }

  private getReceiverBias(layer: VSMDepthPool, receiver: Receiver) {
    const texelBias = receiver.texelMeters.mul(layer.depthBiasTexels);
    const slopeBias = receiver.heightPerPage.length().div(VSM_PAGE_TEXELS);
    return texelBias.add(slopeBias);
  }
}
