import {
  Box3,
  BufferGeometry,
  DepthTexture,
  DoubleSide,
  Float32BufferAttribute,
  LessEqualCompare,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  RedFormat,
  Scene,
  UnsignedByteType,
  UnsignedShortType,
  Vector3,
} from "three";
import {
  MeshBasicNodeMaterial,
  StorageBufferAttribute,
  type ComputeNode,
  RenderTarget,
  type StorageBufferNode,
  type Node,
  type WebGPURenderer,
} from "three/webgpu";
import {
  atomicAdd,
  atomicLoad,
  atomicStore,
  bool,
  cos,
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
  vertexIndex,
  vec2,
  vec4,
} from "three/tsl";
import type {
  ShadowCasterEntry,
  ShadowCasterRegistry,
} from "./ShadowCasterRegistry";
import { ShadowRigidCasterBucket } from "./ShadowRigidCasterBucket";
import { ShadowClusterBucket } from "./ShadowClusterBucket";
import { ShadowDeformedCasterBucket } from "./ShadowDeformedCasterBucket";
import {
  SHADOW_LEVEL_COUNT,
  SHADOW_PAGE_OFFSET,
  SHADOW_PAGE_TEXELS,
  SHADOW_PAGES_PER_LEVEL,
  getShadowReceiverLevel,
  getShadowLightPosition,
  getShadowPageCoordinate,
  getShadowPageKey,
  getShadowPageSize,
  getShadowPageTag,
} from "./ShadowPageCoordinates";
import type { ShadowResidency } from "./ShadowResidency";

type CasterMesh = Mesh<BufferGeometry, MeshBasicNodeMaterial>;

const DEPTH_BIAS_TEXELS = { fixed: 3, moving: 8 };
const PENUMBRA_TAP_COUNT = 8;
const GOLDEN_ANGLE = 2.399963;

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

const getInterleavedGradientNoise = (pixel: Node<"vec2">) =>
  fract(pixel.dot(vec2(0.06711056, 0.00583715)).fract().mul(52.9829189));

export class ShadowRigidAtlas {
  private renderer: WebGPURenderer;
  private residency: ShadowResidency;
  private sunDirection: Node<"vec3">;
  private filter: ShadowFilter;
  private kind: "fixed" | "moving";
  private atlasGridSize: number;
  private renderTarget: RenderTarget;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private pageJobsNode;
  private pageJobOffset: number;
  private minimumY = uniform(-8);
  private maximumY = uniform(64);
  private sources: ShadowCasterEntry[] = [];
  private bucket?: ShadowRigidCasterBucket;
  private casterMeshes: CasterMesh[] = [];
  private clusterCasters: {
    bucket: ShadowClusterBucket;
    mesh: CasterMesh;
  }[] = [];
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
  private registryVersion = -1;
  private movingRevision = -1;
  private fixedRevision = -1;
  private biasVersion = -1;
  private previousSunDirection = new Vector3();
  private bounds = new Box3();
  private isTargetInitialized = false;
  private isReady = uniform(0);
  private depthTextureNode;

  constructor(
    renderer: WebGPURenderer,
    residency: ShadowResidency,
    sunDirection: Node<"vec3">,
    filter: ShadowFilter,
    kind: "fixed" | "moving",
  ) {
    this.renderer = renderer;
    this.residency = residency;
    this.sunDirection = sunDirection;
    this.filter = filter;
    this.kind = kind;
    this.pageJobOffset = kind === "fixed" ? 0 : residency.capacity * 2;
    this.atlasGridSize = Math.ceil(
      Math.sqrt(
        kind === "fixed" ? residency.capacity : residency.dynamicCapacity,
      ),
    );
    const atlasSize = this.atlasGridSize * SHADOW_PAGE_TEXELS;
    this.renderTarget = new RenderTarget(atlasSize, atlasSize, {
      depthBuffer: true,
      format: RedFormat,
      samples: 0,
      stencilBuffer: false,
      type: UnsignedByteType,
    });
    this.renderTarget.texture.name = `V2 ${kind} depth debug`;
    this.renderTarget.texture.magFilter = NearestFilter;
    this.renderTarget.texture.minFilter = NearestFilter;
    const depthTexture = new DepthTexture(
      atlasSize,
      atlasSize,
      UnsignedShortType,
    );
    depthTexture.compareFunction = LessEqualCompare;
    depthTexture.magFilter = LinearFilter;
    depthTexture.minFilter = LinearFilter;
    depthTexture.name = `V2 ${kind} depth`;
    this.renderTarget.depthTexture = depthTexture;
    this.depthTextureNode = texture(depthTexture);
    this.pageJobsNode = storage(
      residency.pageJobsAttribute,
      "uvec4",
      residency.capacity * 3,
    );
    if (kind === "fixed") this.scene.add(this.createClearMesh());
  }

  syncCasters(
    registry: ShadowCasterRegistry,
    sunDirection: Vector3,
    terrainBounds: { min: number; max: number },
  ) {
    const registryVersion =
      this.kind === "fixed"
        ? registry.fixedVersion
        : registry.movingVersion + registry.deformedVersion;
    const hasRosterChange = registryVersion !== this.registryVersion;
    const hasSunChange = !this.previousSunDirection.equals(sunDirection);
    const hasBiasChange =
      this.kind === "fixed" && registry.biasVersion !== this.biasVersion;
    const hasMovement =
      this.kind === "fixed"
        ? registry.fixedRevision !== this.fixedRevision
        : registry.movingRevision !== this.movingRevision;
    if (!hasRosterChange && !hasSunChange && !hasBiasChange && !hasMovement)
      return;

    this.previousSunDirection.copy(sunDirection);
    this.biasVersion = registry.biasVersion;
    this.movingRevision = registry.movingRevision;
    this.fixedRevision = registry.fixedRevision;
    if (hasRosterChange) {
      this.registryVersion = registryVersion;
      if (this.kind === "fixed") this.rebuildClusterCasters(registry);
      else this.rebuildMovingCasters(registry);
    }

    let minimumY = terrainBounds.min - 8;
    let maximumY = terrainBounds.max + 64;
    for (const { bucket } of this.clusterCasters) {
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
    this.bucket?.update(this.sources, sunDirection);
    if (this.kind !== "fixed") return;
    const dirtyBounds = registry.takeFixedDirtyBounds();
    if (hasDepthRangeChange) this.residency.invalidate();
    else if (dirtyBounds.length > 0)
      this.residency.invalidateBounds(dirtyBounds, sunDirection);
  }

  private rebuildClusterCasters(registry: ShadowCasterRegistry) {
    for (const { mesh, bucket } of this.clusterCasters) {
      this.scene.remove(mesh);
      mesh.material.dispose();
      bucket.dispose();
    }
    this.clusterCasters = [];
    const opaqueEntries: ShadowCasterEntry[] = [];
    const groups: ShadowCasterEntry[][] = [opaqueEntries];
    for (const entry of registry.casters) {
      if (!entry.castsShadow || entry.kind !== "fixed" || entry.gpuInstances)
        continue;
      if (entry.opacity) groups.push([entry]);
      else opaqueEntries.push(entry);
    }
    for (const entries of groups) {
      if (entries.length === 0) continue;
      const opacity = entries[0].opacity;
      const bucket = new ShadowClusterBucket(
        this.residency,
        entries,
        this.sunDirection,
        opacity !== undefined,
      );
      const mesh = new Mesh(
        bucket.geometry,
        this.createClusterMaterial(bucket, entries[0]),
      );
      mesh.frustumCulled = false;
      mesh.renderOrder = 1;
      this.scene.add(mesh);
      this.clusterCasters.push({ bucket, mesh });
    }
  }

  private rebuildMovingCasters(registry: ShadowCasterRegistry) {
    this.sources = [];
    for (const { mesh, bucket } of this.deformedCasters) {
      this.scene.remove(mesh);
      mesh.material.dispose();
      bucket.dispose();
    }
    this.deformedCasters = [];
    for (const entry of registry.casters) {
      if (!entry.castsShadow) continue;
      if (entry.gpuInstances) {
        const bucket = new ShadowDeformedCasterBucket(
          this.residency,
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
      const bucket = new ShadowRigidCasterBucket(this.residency, this.sources);
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
    for (const { bucket } of this.clusterCasters)
      nodes.push(...bucket.takeComputeNodes());
    return nodes;
  }

  render() {
    if (
      !this.bucket &&
      this.clusterCasters.length === 0 &&
      this.deformedCasters.length === 0
    )
      return;
    const previousTarget = this.renderer.getRenderTarget();
    const wasAutoClearEnabled = this.renderer.autoClear;
    this.renderer.autoClear = this.kind === "moving";
    this.renderer.setRenderTarget(this.renderTarget);
    try {
      if (!this.isTargetInitialized) {
        this.renderer.clear(true, true, false);
        this.isTargetInitialized = true;
      }
      this.renderer.render(this.scene, this.camera);
      this.isReady.value = 1;
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      this.renderer.autoClear = wasAutoClearEnabled;
    }
  }

  sampleDebugDepth(slot: Node<"uint">, pageUv: Node<"vec2">) {
    const atlasUv = this.computeAtlasUv(slot, pageUv);
    return texture(this.renderTarget.texture).sample(atlasUv).r;
  }

  computeVisibility(
    worldPosition: Node<"vec3">,
    sceneDepth: Node<"float">,
    viewDistance: Node<"float">,
    isSoftReceiver: Node<"bool">,
    dynamicAtlas?: ShadowRigidAtlas,
  ) {
    return Fn(() => {
      const level = getShadowReceiverLevel(viewDistance, isSoftReceiver);
      const texelMeters = getShadowPageSize(
        getShadowReceiverLevel(viewDistance, bool(false)),
      ).div(SHADOW_PAGE_TEXELS);
      const pagePosition = getShadowLightPosition(
        worldPosition,
        this.sunDirection,
      )
        .div(getShadowPageSize(level))
        .toVar();
      const isInside = this.isReady
        .greaterThan(0)
        .and(sceneDepth.lessThan(1))
        .and(this.sunDirection.y.lessThan(-0.25));
      const { softness } = this.filter;
      const visibility = float(1).toVar();
      If(isInside, () => {
        const centerPage = this.lookupPage(
          getShadowPageCoordinate(pagePosition),
          level,
        );
        const visibilitySum = float(0).toVar();
        const weight = float(0).toVar();
        If(isSoftReceiver, () => {
          for (const direction of [
            vec2(-1, -1),
            vec2(1, -1),
            vec2(-1, 1),
            vec2(1, 1),
          ]) {
            const tap = this.sampleTap(
              pagePosition.add(direction.mul(softness).div(SHADOW_PAGE_TEXELS)),
              level,
              centerPage,
              worldPosition,
              texelMeters,
              float(0),
              dynamicAtlas,
            );
            visibilitySum.addAssign(tap.visibility);
            weight.addAssign(tap.weight);
          }
        }).Else(() => {
          const radius = this.computePenumbraTexels(
            pagePosition,
            centerPage,
            worldPosition,
            texelMeters,
            dynamicAtlas,
          );
          const rotation = getInterleavedGradientNoise(screenCoordinate.xy).mul(
            Math.PI * 2,
          );
          for (let tapIndex = 0; tapIndex < PENUMBRA_TAP_COUNT; tapIndex++) {
            const angle = rotation.add(tapIndex * GOLDEN_ANGLE);
            const offset = vec2(cos(angle), sin(angle)).mul(
              radius.mul(Math.sqrt((tapIndex + 0.5) / PENUMBRA_TAP_COUNT)),
            );
            const tap = this.sampleTap(
              pagePosition.add(offset.div(SHADOW_PAGE_TEXELS)),
              level,
              centerPage,
              worldPosition,
              texelMeters,
              radius,
              dynamicAtlas,
            );
            visibilitySum.addAssign(tap.visibility);
            weight.addAssign(tap.weight);
          }
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
    const page = this.residency.resolvePage(
      getShadowPageKey(level, pageCoordinate),
      getShadowPageTag(pageCoordinate),
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
    level: Node<"uint">,
    centerPage: ShadowPageLookup,
    worldPosition: Node<"vec3">,
    texelMeters: Node<"float">,
    radius: Node<"float">,
    dynamicAtlas?: ShadowRigidAtlas,
  ) {
    const halfTexel = 0.5 / SHADOW_PAGE_TEXELS;
    const pageCoordinate = getShadowPageCoordinate(pagePosition).toVar();
    const slot = centerPage.slot.toVar();
    const isResident = centerPage.isResident.toVar();
    const hasDynamic = centerPage.hasDynamic.toVar();
    const dynamicSlot = centerPage.dynamicSlot.toVar();
    If(
      pageCoordinate.x
        .notEqual(centerPage.coordinate.x)
        .or(pageCoordinate.y.notEqual(centerPage.coordinate.y)),
      () => {
        const page = this.residency.resolvePage(
          getShadowPageKey(level, pageCoordinate),
          getShadowPageTag(pageCoordinate),
        );
        slot.assign(page.slot);
        isResident.assign(page.isResident);
        hasDynamic.assign(page.hasDynamic);
        dynamicSlot.assign(page.dynamicSlot);
      },
    );
    const pageUv = pagePosition.fract().clamp(halfTexel, 1 - halfTexel);
    const visibility = this.sampleDepth(
      slot,
      pageUv,
      worldPosition,
      texelMeters,
      radius,
    ).toVar();
    if (dynamicAtlas)
      If(hasDynamic, () => {
        visibility.mulAssign(
          dynamicAtlas.sampleDepth(
            dynamicSlot,
            pageUv,
            worldPosition,
            texelMeters,
            radius,
          ),
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
    worldPosition: Node<"vec3">,
    texelMeters: Node<"float">,
    dynamicAtlas?: ShadowRigidAtlas,
  ) {
    const pageUv = pagePosition.fract();
    const heightSum = float(0).toVar();
    const count = float(0).toVar();
    If(centerPage.isResident, () => {
      const blockers = this.searchBlockers(
        centerPage.slot,
        pageUv,
        worldPosition,
        texelMeters,
      );
      heightSum.addAssign(blockers.heightSum);
      count.addAssign(blockers.count);
    });
    if (dynamicAtlas)
      If(centerPage.hasDynamic, () => {
        const blockers = dynamicAtlas.searchBlockers(
          centerPage.dynamicSlot,
          pageUv,
          worldPosition,
          texelMeters,
        );
        heightSum.addAssign(blockers.heightSum);
        count.addAssign(blockers.count);
      });
    const rayDistance = heightSum
      .div(count.max(1))
      .div(this.sunDirection.y.abs().max(0.25));
    return rayDistance
      .mul(this.filter.lightSize)
      .div(texelMeters)
      .clamp(this.filter.softness, this.filter.maxSoftness)
      .toVar();
  }

  private searchBlockers(
    slot: Node<"uint">,
    pageUv: Node<"vec2">,
    worldPosition: Node<"vec3">,
    texelMeters: Node<"float">,
  ) {
    const tile = uvec2(
      slot.mod(this.atlasGridSize),
      slot.div(this.atlasGridSize),
    ).mul(SHADOW_PAGE_TEXELS);
    const minimumHeight = texelMeters.mul(DEPTH_BIAS_TEXELS[this.kind] * 2);
    let heightSum: Node<"float"> = float(0);
    let count: Node<"float"> = float(0);
    for (const direction of [
      vec2(0, 0),
      vec2(-1, -1),
      vec2(1, -1),
      vec2(-1, 1),
      vec2(1, 1),
    ]) {
      const texel = uvec2(
        pageUv
          .mul(SHADOW_PAGE_TEXELS)
          .add(direction.mul(this.filter.maxSoftness))
          .clamp(0, SHADOW_PAGE_TEXELS - 1),
      );
      const depth = textureLoad(this.depthTextureNode, tile.add(texel)).level(
        uint(0),
      ).r;
      const blockerHeight = this.maximumY
        .sub(depth.mul(this.maximumY.sub(this.minimumY)))
        .sub(worldPosition.y);
      const isBlocker = blockerHeight.greaterThan(minimumHeight);
      heightSum = heightSum.add(isBlocker.select(blockerHeight, float(0)));
      count = count.add(isBlocker.select(float(1), float(0)));
    }
    return { heightSum, count };
  }

  private sampleDepth(
    slot: Node<"uint">,
    pageUv: Node<"vec2">,
    worldPosition: Node<"vec3">,
    texelMeters: Node<"float">,
    radius: Node<"float">,
  ) {
    const receiverDepth = this.maximumY
      .sub(worldPosition.y)
      .sub(texelMeters.mul(radius.add(DEPTH_BIAS_TEXELS[this.kind])))
      .div(this.maximumY.sub(this.minimumY));
    const isInRange = worldPosition.y
      .greaterThanEqual(this.minimumY)
      .and(worldPosition.y.lessThanEqual(this.maximumY));
    return isInRange.select(
      this.depthTextureNode
        .sample(this.computeAtlasUv(slot, pageUv))
        .compare(receiverDepth),
      float(1),
    );
  }

  private createDynamicPrepareNode(bucket?: ShadowRigidCasterBucket) {
    const capacity = this.residency.capacity;
    const counters = storage(
      this.residency.counterAttribute,
      "uint",
      this.residency.counterAttribute.count,
    ).toAtomic();
    const indirect = storage(
      this.residency.atlasIndirectAttribute,
      "uint",
      this.residency.atlasIndirectAttribute.count,
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
        for (let index = 0; index < SHADOW_LEVEL_COUNT * 2; index++)
          atomicStore(
            indirect.element(this.residency.dynamicLevelCounterOffset + index),
            0,
          );
      });
      const activeCount = atomicLoad(
        counters.element(this.residency.activeCountIndex),
      );
      If(instanceIndex.lessThan(activeCount), () => {
        const pageKey = this.pageJobsNode.element(
          instanceIndex.add(capacity),
        ).x;
        const page = this.residency.pageTableNode.element(pageKey);
        page.assign(uvec4(page.x, 0, page.z, this.residency.frame));
      });
    })().compute(capacity, [64]);
  }

  private createDynamicTouchNode(bucket?: ShadowRigidCasterBucket) {
    const capacity = this.residency.capacity;
    const rangesAttribute =
      bucket?.pageRangesAttribute ?? this.emptyRangesAttribute;
    const ranges = storage(rangesAttribute, "uvec4", rangesAttribute.count);
    const counters = storage(
      this.residency.counterAttribute,
      "uint",
      this.residency.counterAttribute.count,
    ).toAtomic();
    const indirect = storage(
      this.residency.atlasIndirectAttribute,
      "uint",
      this.residency.atlasIndirectAttribute.count,
    ).toAtomic();
    const casterCount = bucket?.casterCount ?? 0;
    return Fn(() => {
      const activeCount = atomicLoad(
        counters.element(this.residency.activeCountIndex),
      );
      If(instanceIndex.lessThan(activeCount), () => {
        const job = this.pageJobsNode.element(instanceIndex.add(capacity));
        const level = job.x.div(SHADOW_PAGES_PER_LEVEL);
        If(this.isPageTouched(job, level, ranges, casterCount), () => {
          atomicAdd(
            indirect.element(
              level.add(this.residency.dynamicLevelCounterOffset),
            ),
            1,
          );
        });
      });
    })().compute(capacity, [64]);
  }

  private createDynamicJobsNode(bucket?: ShadowRigidCasterBucket) {
    const capacity = this.residency.capacity;
    const rangesAttribute =
      bucket?.pageRangesAttribute ?? this.emptyRangesAttribute;
    const ranges = storage(rangesAttribute, "uvec4", rangesAttribute.count);
    const counters = storage(
      this.residency.counterAttribute,
      "uint",
      this.residency.counterAttribute.count,
    ).toAtomic();
    const indirect = storage(
      this.residency.atlasIndirectAttribute,
      "uint",
      this.residency.atlasIndirectAttribute.count,
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
        counters.element(this.residency.activeCountIndex),
      );
      If(instanceIndex.lessThan(activeCount), () => {
        const job = this.pageJobsNode.element(instanceIndex.add(capacity));
        const level = job.x.div(SHADOW_PAGES_PER_LEVEL).toVar();
        If(this.isPageTouched(job, level, ranges, casterCount), () => {
          const counterOffset = this.residency.dynamicLevelCounterOffset;
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
              .lessThanEqual(this.residency.dynamicCapacity),
            () => {
              const dynamicSlot = atomicAdd(
                indirect.element(level.add(counterOffset + SHADOW_LEVEL_COUNT)),
                1,
              )
                .add(firstSlot)
                .toVar();
              atomicAdd(indirect.element(5), 1);
              this.pageJobsNode
                .element(dynamicSlot.add(capacity * 2))
                .assign(uvec4(job.x, dynamicSlot, job.z, job.w));
              this.residency.pageTableNode
                .element(job.x)
                .assign(
                  uvec4(
                    job.y.add(1),
                    this.residency.frame,
                    dynamicSlot,
                    this.residency.frame,
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
                          casterIndex.mul(SHADOW_LEVEL_COUNT).add(level),
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
            this.residency.pageTableNode
              .element(job.x)
              .assign(uvec4(job.y.add(1), 0, 0, this.residency.frame));
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
    const isTouched = this.residency.pageTableNode
      .element(job.x)
      .y.equal(this.residency.frame)
      .toVar();
    Loop({ start: 0, end: casterCount, type: "uint" }, ({ i: casterIndex }) => {
      isTouched.assign(
        isTouched.or(
          this.isCasterOnPage(
            ranges.element(casterIndex.mul(SHADOW_LEVEL_COUNT).add(level)),
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

  private createClearMesh() {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(
        [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0],
        3,
      ),
    );
    geometry.setIndirect(this.residency.atlasIndirectAttribute);
    const material = new MeshBasicNodeMaterial();
    material.depthTest = false;
    material.depthWrite = true;
    material.side = DoubleSide;
    material.depthNode = float(1);
    material.vertexNode = Fn(() => {
      const slot = this.pageJobsNode.element(
        instanceIndex.add(this.pageJobOffset),
      ).y;
      const pageUv = positionGeometry.xy.mul(0.5).add(0.5);
      const atlasUv = this.computeAtlasUv(slot, pageUv);
      return vec4(atlasUv.x.mul(2).sub(1), atlasUv.y.mul(-2).add(1), 1, 1);
    })();
    material.fragmentNode = vec4(1);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  private getJobPageUv(job: Node<"uvec4">, worldPosition: Node<"vec3">) {
    return this.getPageUv(
      job.x.div(SHADOW_PAGES_PER_LEVEL),
      vec2(job.z, job.w),
      worldPosition,
    );
  }

  private getPageUv(
    level: Node<"uint">,
    pageCoordinate: Node<"vec2">,
    worldPosition: Node<"vec3">,
  ) {
    return getShadowLightPosition(worldPosition, this.sunDirection)
      .div(getShadowPageSize(level))
      .sub(pageCoordinate.sub(SHADOW_PAGE_OFFSET));
  }

  private createDeformedCasterMaterial(
    bucket: ShadowDeformedCasterBucket,
    entry: ShadowCasterEntry,
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
      const page = this.residency.pageTableNode.element(pageKey);
      const hasDynamicSlot = page.y.equal(this.residency.frame);
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

  private createClusterMaterial(
    bucket: ShadowClusterBucket,
    entry: ShadowCasterEntry,
  ) {
    const workItems = storage(
      bucket.workItemsAttribute,
      "uvec2",
      bucket.workItemsAttribute.count,
    );
    const instanceClusters = storage(
      bucket.instanceClustersAttribute,
      "uvec4",
      bucket.instanceClustersAttribute.count,
    );
    const positions = storage(
      bucket.positionsAttribute,
      "vec4",
      bucket.positionsAttribute.count,
    );
    const matrices = storage(
      bucket.matricesAttribute,
      "vec4",
      bucket.matricesAttribute.count,
    );
    const uvsAttribute = bucket.uvsAttribute;
    const material = new MeshBasicNodeMaterial();
    material.depthTest = true;
    material.depthWrite = true;
    material.side = DoubleSide;
    const pageUv = varyingProperty("vec2", "clusterPageUv");
    const depth = varyingProperty("float", "clusterDepth");
    const casterUv = varyingProperty("vec2", "clusterUv");
    material.vertexNode = Fn(() => {
      const workItem = workItems.element(instanceIndex);
      const job = this.pageJobsNode.element(workItem.x.add(this.pageJobOffset));
      const instanceCluster = instanceClusters.element(workItem.y);
      const vertex = instanceCluster.y.add(vertexIndex);
      const localPosition = positions.element(vertex).xyz;
      const matrixOffset = instanceCluster.x.mul(4);
      const translation = matrices.element(matrixOffset.add(3));
      const worldPosition = matrices
        .element(matrixOffset)
        .mul(localPosition.x)
        .add(matrices.element(matrixOffset.add(1)).mul(localPosition.y))
        .add(matrices.element(matrixOffset.add(2)).mul(localPosition.z))
        .add(vec4(translation.xyz, 0)).xyz;
      if (uvsAttribute)
        casterUv.assign(
          storage(uvsAttribute, "vec2", uvsAttribute.count).element(vertex),
        );
      const casterPageUv = this.getJobPageUv(job, worldPosition);
      const casterDepth = this.maximumY
        .sub(worldPosition.y)
        .add(translation.w)
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
    material.fragmentNode = this.createCasterFragment(
      pageUv,
      depth,
      entry.opacity?.(casterUv),
      entry.alphaTest,
    );
    return material;
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
