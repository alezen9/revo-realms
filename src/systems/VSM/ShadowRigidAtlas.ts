import {
  Box3,
  BufferGeometry,
  DepthTexture,
  DoubleSide,
  LessEqualCompare,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  RedFormat,
  Scene,
  UnsignedByteType,
  UnsignedShortType,
} from "three";
import {
  MeshBasicNodeMaterial,
  StorageBufferAttribute,
  type ComputeNode,
  RenderTarget,
  type StorageBufferNode,
  type TextureNode,
  type Node,
  type WebGPURenderer,
} from "three/webgpu";
import {
  atomicAdd,
  atomicLoad,
  atomicStore,
  bool,
  cos,
  dFdx,
  dFdy,
  float,
  Fn,
  fract,
  If,
  instanceIndex,
  Loop,
  positionGeometry,
  screenCoordinate,
  sin,
  storage,
  texture,
  textureLoad,
  uniform,
  uint,
  uvec2,
  uvec4,
  uv,
  varyingProperty,
  vec2,
  vec4,
} from "three/tsl";
import type { VSMCaster } from "./VSMContext";
import { ShadowRigidCasterBucket } from "./ShadowRigidCasterBucket";
import { ShadowClusterBucket } from "./ShadowClusterBucket";
import { ShadowDeformedCasterBucket } from "./ShadowDeformedCasterBucket";
import { ShadowFixedPool } from "./ShadowFixedPool";
import {
  VSM_LEVEL_COUNT,
  VSM_PAGE_OFFSET,
  VSM_PAGE_TEXELS,
  VSM_PAGES_PER_LEVEL,
  getReceiverLevel,
  getLightPosition,
  getPageCoordinate,
  getPageKey,
  getPageSize,
  getPageTag,
} from "./VSMMath";
import type { VSMContext } from "./VSMContext";

type CasterMesh = Mesh<BufferGeometry, MeshBasicNodeMaterial>;

const DEPTH_BIAS_TEXELS = { fixed: 3, moving: 8 };
const PENUMBRA_TAP_COUNT = 8;
const TENT_RADIUS_TEXELS = 0.51;
const SOFT_TAP_DIRECTIONS = [
  vec2(-0.5, -0.5),
  vec2(0.5, -0.5),
  vec2(-0.5, 0.5),
  vec2(0.5, 0.5),
];
const MAX_RECEIVER_SLOPE = 4;
const GOLDEN_ANGLE = 2.399963;

type AtlasDepthStore =
  | { pool: ShadowFixedPool }
  | { renderTarget: RenderTarget; depthTextureNode: TextureNode };

type ShadowReceiver = {
  worldY: Node<"float">;
  texelMeters: Node<"float">;
  heightPerPage: Node<"vec2">;
};

type ShadowPageLookup = {
  coordinate: Node<"uvec2">;
  slot: Node<"uint">;
  isResident: Node<"bool">;
  hasDynamic: Node<"bool">;
  dynamicSlot: Node<"uint">;
};

export type ShadowFilter = {
  softness: Node<"float">;
  lightSize: Node<"float">;
  maxSoftness: Node<"float">;
};

const getReceiverSlope = (
  lightPosition: Node<"vec2">,
  worldHeight: Node<"float">,
) => {
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

const getInterleavedGradientNoise = (pixel: Node<"vec2">) =>
  fract(pixel.dot(vec2(0.06711056, 0.00583715)).fract().mul(52.9829189));

export class ShadowRigidAtlas {
  private renderer: WebGPURenderer;
  private context: VSMContext;
  private sunDirection: Node<"vec3">;
  private filter: ShadowFilter;
  private kind: "fixed" | "moving";
  private atlasGridSize: number;
  private depthStore: AtlasDepthStore;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private pageJobsNode;
  private pageJobOffset: number;
  private minimumY = uniform(-8);
  private maximumY = uniform(64);
  private sources: VSMCaster[] = [];
  private bucket?: ShadowRigidCasterBucket;
  private casterMeshes: CasterMesh[] = [];
  private clusterCasters = new Map<
    string,
    { bucket: ShadowClusterBucket; rasterNode: ComputeNode }
  >();
  private deformedCasters: {
    bucket: ShadowDeformedCasterBucket;
    mesh: CasterMesh;
  }[] = [];
  private dynamicPrepareNode?: ComputeNode;
  private dynamicTouchNode?: ComputeNode;
  private dynamicJobsNode?: ComputeNode;
  private emptyRangesAttribute = new StorageBufferAttribute(
    new Uint32Array(4),
    4,
  );
  private bounds = new Box3();
  private isReady = uniform(0);

  constructor(
    renderer: WebGPURenderer,
    context: VSMContext,
    sunDirection: Node<"vec3">,
    filter: ShadowFilter,
    kind: "fixed" | "moving",
  ) {
    this.renderer = renderer;
    this.context = context;
    this.sunDirection = sunDirection;
    this.filter = filter;
    this.kind = kind;
    this.pageJobOffset = kind === "fixed" ? 0 : context.capacity * 2;
    this.atlasGridSize = Math.ceil(Math.sqrt(context.dynamicCapacity));
    this.depthStore =
      kind === "fixed"
        ? { pool: new ShadowFixedPool(context) }
        : this.createDepthTarget();
    this.pageJobsNode = storage(
      context.pageJobsAttribute,
      "uvec4",
      context.capacity * 3,
    );
  }

  sync(terrainBounds: { min: number; max: number }) {
    const { changes } = this.context;
    const isFixed = this.kind === "fixed";
    const hasRosterChange = isFixed
      ? changes.hasStaticRosterChanged
      : changes.hasDynamicRosterChanged;
    const hasBiasChange = isFixed && changes.hasStaticBiasChanged;
    const hasMovement = isFixed
      ? changes.hasStaticCasterMoved
      : changes.hasDynamicCasterMoved;
    if (
      !hasRosterChange &&
      !changes.hasSunChanged &&
      !hasBiasChange &&
      !hasMovement
    )
      return;

    if (hasRosterChange) {
      if (isFixed) this.rebuildClusterCasters();
      else this.rebuildMovingCasters();
    }

    let minimumY = terrainBounds.min - 8;
    let maximumY = terrainBounds.max + 64;
    for (const { bucket } of this.clusterCasters.values()) {
      if (hasRosterChange || hasMovement || hasBiasChange)
        bucket.updateMatrices();
      else bucket.invalidateBounds();
      minimumY = Math.min(minimumY, bucket.bounds.min.y);
      maximumY = Math.max(maximumY, bucket.bounds.max.y);
    }
    for (const { mesh } of this.sources) {
      this.bounds.setFromObject(mesh);
      minimumY = Math.min(minimumY, this.bounds.min.y);
      maximumY = Math.max(maximumY, this.bounds.max.y);
    }
    const hasDepthRangeChange =
      this.minimumY.value !== Math.floor(minimumY) ||
      this.maximumY.value !== Math.ceil(maximumY);
    this.minimumY.value = Math.floor(minimumY);
    this.maximumY.value = Math.ceil(maximumY);
    this.bucket?.update(this.sources, this.context.cpuSunDirection);
    if (isFixed && hasDepthRangeChange) this.context.invalidateAllPages();
  }

  private rebuildClusterCasters() {
    if (!("pool" in this.depthStore)) return;
    const { pool } = this.depthStore;
    const groups = new Map<string, VSMCaster[]>([["opaque", []]]);
    for (const entry of this.context.casters) {
      if (entry.kind !== "fixed" || entry.gpuInstances) continue;
      const key = entry.opacity ? entry.mesh.uuid : "opaque";
      const entries = groups.get(key);
      if (entries) entries.push(entry);
      else groups.set(key, [entry]);
    }
    for (const [key, caster] of this.clusterCasters) {
      if (groups.has(key)) continue;
      caster.rasterNode.dispose();
      caster.bucket.dispose();
      this.clusterCasters.delete(key);
    }
    for (const [key, entries] of groups) {
      const caster = this.clusterCasters.get(key);
      if (caster?.bucket.setEntries(entries)) continue;
      caster?.rasterNode.dispose();
      caster?.bucket.dispose();
      const { opacity, alphaTest } = entries[0] ?? { alphaTest: 0 };
      const bucket = new ShadowClusterBucket(
        this.context,
        entries,
        this.sunDirection,
        opacity !== undefined,
      );
      const rasterNode = pool.createRasterNode(bucket, {
        sunDirection: this.sunDirection,
        minimumY: this.minimumY,
        maximumY: this.maximumY,
        opacity,
        alphaTest,
      });
      this.clusterCasters.set(key, { bucket, rasterNode });
    }
  }

  private rebuildMovingCasters() {
    this.sources = [];
    for (const { mesh, bucket } of this.deformedCasters) {
      this.scene.remove(mesh);
      mesh.material.dispose();
      bucket.dispose();
    }
    this.deformedCasters = [];
    for (const entry of this.context.casters) {
      if (entry.gpuInstances) {
        const bucket = new ShadowDeformedCasterBucket(
          this.context,
          entry.mesh,
          entry.gpuInstances,
          this.sunDirection,
        );
        const mesh = new Mesh(
          bucket.geometry,
          this.createDeformedCasterMaterial(bucket, entry),
        );
        mesh.frustumCulled = false;
        mesh.renderOrder = 3;
        this.scene.add(mesh);
        this.deformedCasters.push({ bucket, mesh });
        continue;
      }
      if (entry.kind === "moving") this.sources.push(entry);
    }
    for (const mesh of this.casterMeshes) this.scene.remove(mesh);
    this.casterMeshes[0]?.material.dispose();
    this.casterMeshes = [];
    this.bucket?.dispose();
    this.bucket = undefined;
    if (this.sources.length > 0) {
      const bucket = new ShadowRigidCasterBucket(this.context, this.sources);
      const material = this.createCasterMaterial(bucket);
      for (const geometry of bucket.geometries) {
        const mesh = new Mesh(geometry, material);
        mesh.frustumCulled = false;
        mesh.renderOrder = 1;
        this.scene.add(mesh);
        this.casterMeshes.push(mesh);
      }
      this.bucket = bucket;
    }
    this.dynamicPrepareNode?.dispose();
    this.dynamicTouchNode?.dispose();
    this.dynamicJobsNode?.dispose();
    this.dynamicPrepareNode = this.createDynamicPrepareNode(this.bucket);
    this.dynamicTouchNode = this.createDynamicTouchNode(this.bucket);
    this.dynamicJobsNode = this.createDynamicJobsNode(this.bucket);
  }

  takeComputeNodes() {
    const nodes: ComputeNode[] = [];
    if (this.dynamicPrepareNode) nodes.push(this.dynamicPrepareNode);
    for (const { bucket } of this.deformedCasters)
      nodes.push(...bucket.computeNodes);
    if (this.dynamicTouchNode && this.dynamicJobsNode)
      nodes.push(this.dynamicTouchNode, this.dynamicJobsNode);
    if ("pool" in this.depthStore) {
      nodes.push(this.depthStore.pool.clearComputeNode);
      this.isReady.value = 1;
    }
    for (const { bucket, rasterNode } of this.clusterCasters.values())
      nodes.push(...bucket.takeComputeNodes(), rasterNode);
    return nodes;
  }

  render() {
    if (!("renderTarget" in this.depthStore)) return;
    if (!this.bucket && this.deformedCasters.length === 0) return;
    const previousTarget = this.renderer.getRenderTarget();
    const wasAutoClearEnabled = this.renderer.autoClear;
    this.renderer.autoClear = true;
    this.renderer.setRenderTarget(this.depthStore.renderTarget);
    try {
      this.renderer.render(this.scene, this.camera);
      this.isReady.value = 1;
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      this.renderer.autoClear = wasAutoClearEnabled;
    }
  }

  sampleDebugDepth(slot: Node<"uint">, pageUv: Node<"vec2">) {
    return this.loadDepth(
      slot,
      uvec2(
        pageUv
          .mul(VSM_PAGE_TEXELS)
          .floor()
          .clamp(0, VSM_PAGE_TEXELS - 1),
      ),
    );
  }

  computeVisibility(
    worldPosition: Node<"vec3">,
    sceneDepth: Node<"float">,
    viewDistance: Node<"float">,
    isSoftReceiver: Node<"bool">,
    dynamicAtlas?: ShadowRigidAtlas,
  ) {
    return Fn(() => {
      const level = getReceiverLevel(viewDistance, isSoftReceiver).toVar();
      const pageSize = getPageSize(level).toVar();
      const lightPosition = getLightPosition(
        worldPosition,
        this.sunDirection,
      ).toVar();
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
      const isInside = this.isReady
        .greaterThan(0)
        .and(sceneDepth.lessThan(1))
        .and(this.sunDirection.y.lessThan(-0.25));
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
          .and(this.kind === "fixed" ? centerPage.isResident : bool(false))
          .toVar();
        If(isSoftReceiver, () => {
          If(isTentAvailable, () => {
            visibilitySum.assign(
              this.sampleTent(pagePosition, centerPage, receiver, dynamicAtlas),
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
                dynamicAtlas,
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
            dynamicAtlas,
          );
          If(
            isTentAvailable.and(radius.lessThanEqual(TENT_RADIUS_TEXELS)),
            () => {
              visibilitySum.assign(
                this.sampleTent(
                  pagePosition,
                  centerPage,
                  receiver,
                  dynamicAtlas,
                ),
              );
              weight.assign(1);
            },
          ).Else(() => {
            const rotation = getInterleavedGradientNoise(
              screenCoordinate.xy,
            ).mul(Math.PI * 2);
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
                dynamicAtlas,
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
    })();
  }

  private lookupPage(
    pageCoordinate: Node<"uvec2">,
    level: Node<"uint">,
  ): ShadowPageLookup {
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
    pagePosition: Node<"vec2">,
    pageOffset: Node<"vec2">,
    level: Node<"uint">,
    centerPage: ShadowPageLookup,
    receiver: ShadowReceiver,
    dynamicAtlas?: ShadowRigidAtlas,
  ) {
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
    const visibility = this.sampleDepth(
      this.kind === "fixed" ? slot : dynamicSlot,
      pageUv,
      pageOffset,
      receiver,
    ).toVar();
    if (dynamicAtlas)
      If(hasDynamic, () => {
        visibility.mulAssign(
          dynamicAtlas.sampleDepth(dynamicSlot, pageUv, pageOffset, receiver),
        );
      });
    const weight = (this.kind === "fixed" ? isResident : hasDynamic).select(
      float(1),
      float(0),
    );
    return { visibility: visibility.mul(weight), weight };
  }

  private computePenumbraTexels(
    pagePosition: Node<"vec2">,
    centerPage: ShadowPageLookup,
    receiver: ShadowReceiver,
    dynamicAtlas?: ShadowRigidAtlas,
  ) {
    const pageUv = pagePosition.fract();
    const heightSum = float(0).toVar();
    const count = float(0).toVar();
    const isFixed = this.kind === "fixed";
    If(isFixed ? centerPage.isResident : centerPage.hasDynamic, () => {
      const blockers = this.searchBlockers(
        isFixed ? centerPage.slot : centerPage.dynamicSlot,
        pageUv,
        receiver,
      );
      heightSum.addAssign(blockers.heightSum);
      count.addAssign(blockers.count);
    });
    if (dynamicAtlas)
      If(centerPage.hasDynamic, () => {
        const blockers = dynamicAtlas.searchBlockers(
          centerPage.dynamicSlot,
          pageUv,
          receiver,
        );
        heightSum.addAssign(blockers.heightSum);
        count.addAssign(blockers.count);
      });
    const rayDistance = heightSum
      .div(count.max(1))
      .div(this.sunDirection.y.abs().max(0.25));
    return rayDistance
      .mul(this.filter.lightSize)
      .div(receiver.texelMeters)
      .clamp(this.filter.softness, this.filter.maxSoftness)
      .toVar();
  }

  private searchBlockers(
    slot: Node<"uint">,
    pageUv: Node<"vec2">,
    receiver: ShadowReceiver,
  ) {
    const minimumHeight = this.getReceiverBias(receiver).mul(2);
    let heightSum: Node<"float"> = float(0);
    let count: Node<"float"> = float(0);
    for (const direction of [
      vec2(0, 0),
      vec2(-1, -1),
      vec2(1, -1),
      vec2(-1, 1),
      vec2(1, 1),
    ]) {
      const texelOffset = direction.mul(this.filter.maxSoftness);
      const texel = uvec2(
        pageUv
          .mul(VSM_PAGE_TEXELS)
          .add(texelOffset)
          .clamp(0, VSM_PAGE_TEXELS - 1),
      );
      const depth = this.loadDepth(slot, texel);
      const blockerHeight = this.maximumY
        .sub(depth.mul(this.maximumY.sub(this.minimumY)))
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
    slot: Node<"uint">,
    pageUv: Node<"vec2">,
    pageOffset: Node<"vec2">,
    receiver: ShadowReceiver,
  ) {
    const receiverDepth = this.maximumY
      .sub(this.getReceiverHeight(receiver, pageOffset))
      .sub(this.getReceiverBias(receiver))
      .div(this.maximumY.sub(this.minimumY));
    const isInRange = receiver.worldY
      .greaterThanEqual(this.minimumY)
      .and(receiver.worldY.lessThanEqual(this.maximumY));
    return isInRange.select(
      this.compareDepth(slot, pageUv, receiverDepth),
      float(1),
    );
  }

  private sampleTent(
    pagePosition: Node<"vec2">,
    centerPage: ShadowPageLookup,
    receiver: ShadowReceiver,
    dynamicAtlas?: ShadowRigidAtlas,
  ) {
    const visibility = this.sampleDepthTent(
      centerPage.slot,
      pagePosition.fract(),
      receiver,
    ).toVar();
    if (dynamicAtlas)
      If(centerPage.hasDynamic, () => {
        const dynamicSum = float(0).toVar();
        for (const direction of SOFT_TAP_DIRECTIONS) {
          const pageOffset = direction.div(VSM_PAGE_TEXELS);
          dynamicSum.addAssign(
            dynamicAtlas.sampleDepth(
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

  private sampleDepthTent(
    slot: Node<"uint">,
    pageUv: Node<"vec2">,
    receiver: ShadowReceiver,
  ) {
    const depthRange = this.maximumY.sub(this.minimumY);
    const receiverDepth = this.maximumY
      .sub(receiver.worldY)
      .sub(this.getReceiverBias(receiver))
      .div(depthRange);
    const isInRange = receiver.worldY
      .greaterThanEqual(this.minimumY)
      .and(receiver.worldY.lessThanEqual(this.maximumY));
    if (!("pool" in this.depthStore)) return float(1);
    return isInRange.select(
      this.depthStore.pool.compareDepthTent(
        slot,
        pageUv,
        receiverDepth,
        receiver.heightPerPage.negate().div(depthRange),
      ),
      float(1),
    );
  }

  private loadDepth(slot: Node<"uint">, texel: Node<"uvec2">) {
    if ("pool" in this.depthStore)
      return this.depthStore.pool.loadDepth(slot, texel);
    const tile = uvec2(
      slot.mod(this.atlasGridSize),
      slot.div(this.atlasGridSize),
    ).mul(VSM_PAGE_TEXELS);
    return textureLoad(this.depthStore.depthTextureNode, tile.add(texel)).level(
      uint(0),
    ).r;
  }

  private compareDepth(
    slot: Node<"uint">,
    pageUv: Node<"vec2">,
    receiverDepth: Node<"float">,
  ) {
    if ("pool" in this.depthStore)
      return this.depthStore.pool.compareDepth(slot, pageUv, receiverDepth);
    return this.depthStore.depthTextureNode
      .sample(this.computeAtlasUv(slot, pageUv))
      .compare(receiverDepth).r;
  }

  private createDepthTarget() {
    const atlasSize = this.atlasGridSize * VSM_PAGE_TEXELS;
    const renderTarget = new RenderTarget(atlasSize, atlasSize, {
      depthBuffer: true,
      format: RedFormat,
      samples: 0,
      stencilBuffer: false,
      type: UnsignedByteType,
    });
    renderTarget.texture.name = `V2 ${this.kind} depth debug`;
    const depthTexture = new DepthTexture(
      atlasSize,
      atlasSize,
      UnsignedShortType,
    );
    depthTexture.compareFunction = LessEqualCompare;
    depthTexture.magFilter = LinearFilter;
    depthTexture.minFilter = LinearFilter;
    depthTexture.name = `V2 ${this.kind} depth`;
    renderTarget.depthTexture = depthTexture;
    return { renderTarget, depthTextureNode: texture(depthTexture) };
  }

  private getReceiverHeight(
    receiver: ShadowReceiver,
    pageOffset: Node<"vec2">,
  ) {
    return receiver.worldY.add(receiver.heightPerPage.dot(pageOffset));
  }

  private getReceiverBias(receiver: ShadowReceiver) {
    return receiver.texelMeters
      .mul(DEPTH_BIAS_TEXELS[this.kind])
      .add(receiver.heightPerPage.length().div(VSM_PAGE_TEXELS));
  }

  private createDynamicPrepareNode(bucket?: ShadowRigidCasterBucket) {
    const capacity = this.context.capacity;
    const counters = storage(
      this.context.counterAttribute,
      "uint",
      this.context.counterAttribute.count,
    ).toAtomic();
    const indirect = storage(
      this.context.atlasIndirectAttribute,
      "uint",
      this.context.atlasIndirectAttribute.count,
    ).toAtomic();
    const groupIndirect = bucket
      ? storage(
          bucket.groupIndirectAttribute,
          "uint",
          bucket.groupCount * 4,
        ).toAtomic()
      : undefined;
    return Fn(() => {
      If(instanceIndex.equal(0), () => {
        atomicStore(indirect.element(5), 0);
        atomicStore(indirect.element(6), 0);
        for (let group = 0; group < (bucket?.groupCount ?? 0); group++)
          if (groupIndirect)
            atomicStore(groupIndirect.element(group * 4 + 1), 0);
        for (let index = 0; index < VSM_LEVEL_COUNT * 2; index++)
          atomicStore(
            indirect.element(this.context.dynamicLevelCounterOffset + index),
            0,
          );
      });
      const activeCount = atomicLoad(
        counters.element(this.context.activeCountIndex),
      );
      If(instanceIndex.lessThan(activeCount), () => {
        const pageKey = this.pageJobsNode.element(
          instanceIndex.add(capacity),
        ).x;
        const page = this.context.pageTableNode.element(pageKey);
        page.assign(uvec4(page.x, 0, page.z, this.context.frame));
      });
    })().compute(capacity, [64]);
  }

  private createDynamicTouchNode(bucket?: ShadowRigidCasterBucket) {
    const capacity = this.context.capacity;
    const rangesAttribute =
      bucket?.pageRangesAttribute ?? this.emptyRangesAttribute;
    const ranges = storage(rangesAttribute, "uvec4", rangesAttribute.count);
    const counters = storage(
      this.context.counterAttribute,
      "uint",
      this.context.counterAttribute.count,
    ).toAtomic();
    const indirect = storage(
      this.context.atlasIndirectAttribute,
      "uint",
      this.context.atlasIndirectAttribute.count,
    ).toAtomic();
    const casterCount = bucket?.casterCount ?? 0;
    return Fn(() => {
      const activeCount = atomicLoad(
        counters.element(this.context.activeCountIndex),
      );
      If(instanceIndex.lessThan(activeCount), () => {
        const job = this.pageJobsNode.element(instanceIndex.add(capacity));
        const level = job.x.div(VSM_PAGES_PER_LEVEL);
        If(this.isPageTouched(job, level, ranges, casterCount), () => {
          atomicAdd(
            indirect.element(level.add(this.context.dynamicLevelCounterOffset)),
            1,
          );
        });
      });
    })().compute(capacity, [64]);
  }

  private createDynamicJobsNode(bucket?: ShadowRigidCasterBucket) {
    const capacity = this.context.capacity;
    const rangesAttribute =
      bucket?.pageRangesAttribute ?? this.emptyRangesAttribute;
    const ranges = storage(rangesAttribute, "uvec4", rangesAttribute.count);
    const counters = storage(
      this.context.counterAttribute,
      "uint",
      this.context.counterAttribute.count,
    ).toAtomic();
    const indirect = storage(
      this.context.atlasIndirectAttribute,
      "uint",
      this.context.atlasIndirectAttribute.count,
    ).toAtomic();
    const casterCount = bucket?.casterCount ?? 0;
    const groups = bucket
      ? storage(bucket.casterGroupsAttribute, "uint", casterCount)
      : undefined;
    const groupIndirect = bucket
      ? storage(
          bucket.groupIndirectAttribute,
          "uint",
          bucket.groupCount * 4,
        ).toAtomic()
      : undefined;
    const workItems = bucket
      ? storage(
          bucket.workItemsAttribute,
          "uvec2",
          bucket.workItemsAttribute.count,
        )
      : undefined;
    return Fn(() => {
      const activeCount = atomicLoad(
        counters.element(this.context.activeCountIndex),
      );
      If(instanceIndex.lessThan(activeCount), () => {
        const job = this.pageJobsNode.element(instanceIndex.add(capacity));
        const level = job.x.div(VSM_PAGES_PER_LEVEL).toVar();
        If(this.isPageTouched(job, level, ranges, casterCount), () => {
          const counterOffset = this.context.dynamicLevelCounterOffset;
          const firstSlot = uint(0).toVar();
          Loop(
            { start: uint(0), end: level, type: "uint" },
            ({ i: finerLevel }) => {
              firstSlot.addAssign(
                atomicLoad(indirect.element(finerLevel.add(counterOffset))),
              );
            },
          );
          const levelCount = atomicLoad(
            indirect.element(level.add(counterOffset)),
          );
          If(
            firstSlot
              .add(levelCount)
              .lessThanEqual(this.context.dynamicCapacity),
            () => {
              const dynamicSlot = atomicAdd(
                indirect.element(level.add(counterOffset + VSM_LEVEL_COUNT)),
                1,
              )
                .add(firstSlot)
                .toVar();
              atomicAdd(indirect.element(5), 1);
              this.pageJobsNode
                .element(dynamicSlot.add(capacity * 2))
                .assign(uvec4(job.x, dynamicSlot, job.z, job.w));
              this.context.pageTableNode
                .element(job.x)
                .assign(
                  uvec4(
                    job.y.add(1),
                    this.context.frame,
                    dynamicSlot,
                    this.context.frame,
                  ),
                );
              if (groups && groupIndirect && workItems)
                Loop(
                  { start: 0, end: casterCount, type: "uint" },
                  ({ i: casterLoopIndex }) => {
                    const casterIndex = casterLoopIndex.toVar();
                    If(
                      this.isCasterOnPage(
                        ranges.element(
                          casterIndex.mul(VSM_LEVEL_COUNT).add(level),
                        ),
                        job,
                      ),
                      () => {
                        const group = groups.element(casterIndex);
                        const itemIndex = atomicAdd(
                          groupIndirect.element(group.mul(4).add(1)),
                          1,
                        );
                        const firstItem = atomicLoad(
                          groupIndirect.element(group.mul(4).add(3)),
                        );
                        workItems
                          .element(firstItem.add(itemIndex))
                          .assign(uvec2(dynamicSlot, casterIndex));
                      },
                    );
                  },
                );
            },
          ).Else(() => {
            atomicAdd(indirect.element(6), 1);
            this.context.pageTableNode
              .element(job.x)
              .assign(uvec4(job.y.add(1), 0, 0, this.context.frame));
          });
        });
      });
    })().compute(capacity, [64]);
  }

  private isPageTouched(
    job: Node<"uvec4">,
    level: Node<"uint">,
    ranges: StorageBufferNode<"uvec4">,
    casterCount: number,
  ) {
    const isTouched = this.context.pageTableNode
      .element(job.x)
      .y.equal(this.context.frame)
      .toVar();
    Loop({ start: 0, end: casterCount, type: "uint" }, ({ i: casterIndex }) => {
      isTouched.assign(
        isTouched.or(
          this.isCasterOnPage(
            ranges.element(casterIndex.mul(VSM_LEVEL_COUNT).add(level)),
            job,
          ),
        ),
      );
    });
    return isTouched;
  }

  private isCasterOnPage(range: Node<"uvec4">, job: Node<"uvec4">) {
    return job.z
      .greaterThanEqual(range.x)
      .and(job.w.greaterThanEqual(range.y))
      .and(job.z.lessThanEqual(range.z))
      .and(job.w.lessThanEqual(range.w));
  }

  private computeAtlasUv(slot: Node<"uint">, pageUv: Node<"vec2">) {
    const tile = vec2(
      float(slot.mod(this.atlasGridSize)),
      float(slot.div(this.atlasGridSize)),
    );
    return tile.add(pageUv).div(this.atlasGridSize);
  }

  private getJobPageUv(job: Node<"uvec4">, worldPosition: Node<"vec3">) {
    return this.getPageUv(
      job.x.div(VSM_PAGES_PER_LEVEL),
      vec2(job.z, job.w),
      worldPosition,
    );
  }

  private getPageUv(
    level: Node<"uint">,
    pageCoordinate: Node<"vec2">,
    worldPosition: Node<"vec3">,
  ) {
    return getLightPosition(worldPosition, this.sunDirection)
      .div(getPageSize(level))
      .sub(pageCoordinate.sub(VSM_PAGE_OFFSET));
  }

  private createDeformedCasterMaterial(
    bucket: ShadowDeformedCasterBucket,
    entry: VSMCaster,
  ) {
    const material = new MeshBasicNodeMaterial();
    material.depthTest = true;
    material.depthWrite = true;
    material.side = DoubleSide;
    const pageUv = varyingProperty("vec2", "deformedPageUv");
    const depth = varyingProperty("float", "deformedDepth");
    material.vertexNode = Fn(() => {
      const { pageKey, level, instance, pageCoordinate } =
        bucket.getWorkItem(instanceIndex);
      const page = this.context.pageTableNode.element(pageKey);
      const hasDynamicSlot = page.y.equal(this.context.frame);
      const worldPosition = bucket.instances.worldPosition(
        instance,
        positionGeometry,
      );
      const casterPageUv = this.getPageUv(level, pageCoordinate, worldPosition);
      const casterDepth = this.maximumY
        .sub(worldPosition.y)
        .add(entry.depthBias)
        .div(this.maximumY.sub(this.minimumY));
      pageUv.assign(casterPageUv);
      depth.assign(casterDepth);
      const atlasUv = this.computeAtlasUv(page.z, casterPageUv);
      return hasDynamicSlot.select(
        vec4(atlasUv.x.mul(2).sub(1), atlasUv.y.mul(-2).add(1), casterDepth, 1),
        vec4(0, 0, -1, 1),
      );
    })();
    material.fragmentNode = this.createCasterFragment(
      pageUv,
      depth,
      entry.opacity?.(uv()),
      entry.alphaTest,
    );
    return material;
  }

  private createCasterFragment(
    pageUv: Node<"vec2">,
    depth: Node<"float">,
    opacity?: Node<"float">,
    alphaTest = 0,
  ) {
    return Fn(() => {
      pageUv.x
        .lessThan(0)
        .or(pageUv.y.lessThan(0))
        .or(pageUv.x.greaterThan(1))
        .or(pageUv.y.greaterThan(1))
        .discard();
      if (opacity) opacity.lessThan(alphaTest).discard();
      return vec4(depth, 0, 0, 1);
    })();
  }

  private createCasterMaterial(bucket: ShadowRigidCasterBucket) {
    const matrices = storage(
      bucket.matrixColumnsAttribute,
      "vec4",
      bucket.matrixColumnsAttribute.count,
    );
    const workItems = storage(
      bucket.workItemsAttribute,
      "uvec2",
      bucket.workItemsAttribute.count,
    );
    const depthBiases = storage(
      bucket.depthBiasAttribute,
      "float",
      bucket.depthBiasAttribute.count,
    );
    const material = new MeshBasicNodeMaterial();
    material.depthTest = true;
    material.depthWrite = true;
    material.side = DoubleSide;
    const pageUv = varyingProperty("vec2", "rigidPageUv");
    const depth = varyingProperty("float", "rigidDepth");
    material.vertexNode = Fn(() => {
      const workItem = workItems.element(instanceIndex);
      const casterIndex = workItem.y;
      const matrixOffset = casterIndex.mul(4);
      const worldPosition = matrices
        .element(matrixOffset)
        .mul(positionGeometry.x)
        .add(matrices.element(matrixOffset.add(1)).mul(positionGeometry.y))
        .add(matrices.element(matrixOffset.add(2)).mul(positionGeometry.z))
        .add(matrices.element(matrixOffset.add(3))).xyz;
      const job = this.pageJobsNode.element(workItem.x.add(this.pageJobOffset));
      const casterPageUv = this.getJobPageUv(job, worldPosition);
      const casterDepth = this.maximumY
        .sub(worldPosition.y)
        .add(depthBiases.element(casterIndex))
        .div(this.maximumY.sub(this.minimumY));
      pageUv.assign(casterPageUv);
      depth.assign(casterDepth);
      const atlasUv = this.computeAtlasUv(job.y, casterPageUv);
      return vec4(
        atlasUv.x.mul(2).sub(1),
        atlasUv.y.mul(-2).add(1),
        casterDepth,
        1,
      );
    })();
    material.fragmentNode = this.createCasterFragment(pageUv, depth);
    return material;
  }
}
