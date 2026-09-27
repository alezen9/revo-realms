import {
  Box3,
  BufferGeometry,
  DepthTexture,
  DoubleSide,
  Float32BufferAttribute,
  LessEqualCompare,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  RedFormat,
  Scene,
  UnsignedByteType,
  UnsignedShortType,
  Vector3,
} from "three";
import {
  IndirectStorageBufferAttribute,
  MeshBasicNodeMaterial,
  RenderTarget,
  StorageBufferAttribute,
  type ComputeNode,
  type Node,
  type StorageBufferNode,
  type TextureNode,
  type UniformNode,
  type WebGPURenderer,
} from "three/webgpu";
import {
  atomicAdd,
  atomicLoad,
  atomicStore,
  atomicSub,
  bool,
  float,
  Fn,
  If,
  instanceIndex,
  Loop,
  positionGeometry,
  storage,
  texture,
  textureLoad,
  uint,
  uniform,
  uv,
  uvec2,
  uvec4,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  VSM_COUNTER_ACTIVE,
  VSM_COUNTER_COUNT,
  VSM_DYNAMIC_CAPACITY,
  VSM_DYNAMIC_COUNTER_COUNT,
  VSM_DYNAMIC_COUNTER_LEVEL_COUNTS,
  VSM_DYNAMIC_COUNTER_LEVEL_CURSORS,
  VSM_DYNAMIC_COUNTER_OVERFLOW,
  VSM_DYNAMIC_COUNTER_TOTAL,
  VSM_JOB_COUNT,
  VSM_JOBS_ACTIVE,
  VSM_JOBS_DYNAMIC,
  VSM_POOL_CAPACITY,
  type VSMCaster,
  type VSMContext,
  type VSMGpuInstances,
} from "./VSMContext";
import {
  VSMDepthPool,
  type VSMRasterCaster,
  type VSMRasterSource,
  type VSMRasterWork,
} from "./VSMDepthPool";
import {
  VSM_CLUSTER_VERTICES,
  appendGeometryClusters,
} from "./VSMClusterBucket";
import {
  VSM_LEVEL_COUNT,
  VSM_PAGE_COUNT,
  VSM_PAGE_OFFSET,
  VSM_PAGE_TEXELS,
  VSM_PAGES_PER_LEVEL,
  computePageCoordinate,
  getLightPosition,
  getPageCoordinate,
  getPageKey,
  getPageSize,
  getPageTag,
  getReceiverLevel,
} from "./VSMMath";

type CasterMesh = Mesh<BufferGeometry, MeshBasicNodeMaterial>;

type DeformedCaster = {
  bucket: DeformedCasterBucket;
  mesh: CasterMesh;
};

const MAX_DEFORMED_WORK_ITEMS = 262144;
const ATLAS_GRID_SIZE = Math.ceil(Math.sqrt(VSM_DYNAMIC_CAPACITY));
const ATLAS_SIZE = ATLAS_GRID_SIZE * VSM_PAGE_TEXELS;

export class VSMDynamicLayer {
  readonly minimumY: UniformNode<"float", number>;
  readonly maximumY: UniformNode<"float", number>;
  readonly isReady = uniform(0);
  readonly useMovingPool = uniform(0);
  private movingPool: VSMDepthPool;
  readonly depthBiasTexels = 8;
  private renderer: WebGPURenderer;
  private context: VSMContext;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private renderTarget: RenderTarget;
  private depthTextureNode: TextureNode;
  private pageJobsNode;
  private sources: VSMCaster[] = [];
  private rigidBucket?: RigidCasterBucket;
  private casterMeshes: CasterMesh[] = [];
  private deformedCasters: DeformedCaster[] = [];
  private prepareNode?: ComputeNode;
  private touchNode?: ComputeNode;
  private jobsNode?: ComputeNode;
  private emptyRangesAttribute = new StorageBufferAttribute(
    new Uint32Array(4),
    4,
  );

  constructor(renderer: WebGPURenderer, context: VSMContext) {
    this.renderer = renderer;
    this.context = context;
    this.pageJobsNode = storage(context.pageJobs, "uvec4", VSM_JOB_COUNT);
    this.movingPool = new VSMDepthPool(context, {
      kind: "moving",
      capacity: VSM_DYNAMIC_CAPACITY,
      jobs: context.dynamicJobs,
      depthBiasTexels: this.depthBiasTexels,
    });
    this.minimumY = this.movingPool.minimumY;
    this.maximumY = this.movingPool.maximumY;
    this.renderTarget = new RenderTarget(ATLAS_SIZE, ATLAS_SIZE, {
      depthBuffer: true,
      format: RedFormat,
      samples: 0,
      stencilBuffer: false,
      type: UnsignedByteType,
    });
    this.renderTarget.texture.name = "VSM dynamic depth debug";
    const depthTexture = new DepthTexture(
      ATLAS_SIZE,
      ATLAS_SIZE,
      UnsignedShortType,
    );
    depthTexture.compareFunction = LessEqualCompare;
    depthTexture.magFilter = LinearFilter;
    depthTexture.minFilter = LinearFilter;
    depthTexture.name = "VSM dynamic depth";
    this.renderTarget.depthTexture = depthTexture;
    this.depthTextureNode = texture(depthTexture);
  }

  sync(terrainBounds: { min: number; max: number }) {
    const { changes } = this.context;
    if (
      !changes.hasDynamicRosterChanged &&
      !changes.hasSunChanged &&
      !changes.hasDynamicCasterMoved
    )
      return;

    if (changes.hasDynamicRosterChanged) this.rebuildCasters();
    this.movingPool.sync(terrainBounds);
    const { x: lightX, y: lightY } = this.context.lightBasis;
    this.rigidBucket?.update(this.sources, lightX.value, lightY.value);
  }

  getComputeNodes() {
    const nodes: ComputeNode[] = [];
    if (this.prepareNode) nodes.push(this.prepareNode);
    for (const { bucket } of this.deformedCasters)
      nodes.push(...bucket.computeNodes);
    if (this.touchNode && this.jobsNode)
      nodes.push(this.touchNode, this.jobsNode);
    if (this.useMovingPool.value > 0)
      nodes.push(...this.movingPool.getComputeNodes());
    return nodes;
  }

  render() {
    if (!this.rigidBucket && this.deformedCasters.length === 0) return;
    if (this.useMovingPool.value > 0) {
      this.isReady.value = 1;
      return;
    }
    const previousTarget = this.renderer.getRenderTarget();
    const wasAutoClearEnabled = this.renderer.autoClear;
    this.renderer.autoClear = true;
    this.renderer.setRenderTarget(this.renderTarget);
    try {
      this.renderer.render(this.scene, this.camera);
      this.isReady.value = 1;
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      this.renderer.autoClear = wasAutoClearEnabled;
    }
  }

  loadDepth(slot: Node<"uint">, texel: Node<"uvec2">) {
    const tile = uvec2(
      slot.mod(ATLAS_GRID_SIZE),
      slot.div(ATLAS_GRID_SIZE),
    ).mul(VSM_PAGE_TEXELS);
    return this.useMovingPool
      .greaterThan(0)
      .select(
        this.movingPool.loadDepth(slot, texel),
        textureLoad(this.depthTextureNode, tile.add(texel)).level(uint(0)).r,
      );
  }

  compareDepth(
    slot: Node<"uint">,
    pageUv: Node<"vec2">,
    receiverDepth: Node<"float">,
  ) {
    return this.useMovingPool
      .greaterThan(0)
      .select(
        this.movingPool.compareDepth(slot, pageUv, receiverDepth),
        this.depthTextureNode
          .sample(this.computeAtlasUv(slot, pageUv))
          .compare(receiverDepth).r,
      );
  }

  private rebuildCasters() {
    this.sources = [];
    for (const { mesh, bucket } of this.deformedCasters) {
      this.scene.remove(mesh);
      mesh.material.dispose();
      bucket.dispose();
    }
    this.deformedCasters = [];
    const instanceCasters: VSMRasterCaster[] = [];
    for (const caster of this.context.casters) {
      if (caster.gpuInstances) {
        const bucket = new DeformedCasterBucket(
          this.context,
          caster.mesh,
          caster.gpuInstances,
        );
        instanceCasters.push({
          source: new InstanceRasterSource(this.context, bucket, caster),
          alphaTest: caster.alphaTest,
          opacity: caster.opacity,
        });
        const mesh = new Mesh(
          bucket.geometry,
          this.createDeformedCasterMaterial(bucket, caster),
        );
        mesh.frustumCulled = false;
        mesh.renderOrder = 3;
        this.scene.add(mesh);
        this.deformedCasters.push({ bucket, mesh });
        continue;
      }
      if (caster.kind === "moving") this.sources.push(caster);
    }
    this.movingPool.setInstanceCasters(instanceCasters);
    for (const mesh of this.casterMeshes) this.scene.remove(mesh);
    this.casterMeshes[0]?.material.dispose();
    this.casterMeshes = [];
    this.rigidBucket?.dispose();
    this.rigidBucket = undefined;
    if (this.sources.length > 0) {
      const bucket = new RigidCasterBucket(this.sources);
      const material = this.createCasterMaterial(bucket);
      for (const geometry of bucket.geometries) {
        const mesh = new Mesh(geometry, material);
        mesh.frustumCulled = false;
        mesh.renderOrder = 1;
        this.scene.add(mesh);
        this.casterMeshes.push(mesh);
      }
      this.rigidBucket = bucket;
    }
    this.prepareNode?.dispose();
    this.touchNode?.dispose();
    this.jobsNode?.dispose();
    this.prepareNode = this.createPrepareNode(this.rigidBucket);
    this.touchNode = this.createTouchNode(this.rigidBucket);
    this.jobsNode = this.createJobsNode(this.rigidBucket);
  }

  private createPrepareNode(bucket?: RigidCasterBucket) {
    const { context } = this;
    const counters = storage(
      context.counters,
      "uint",
      VSM_COUNTER_COUNT,
    ).toAtomic();
    const dynamicCounters = storage(
      context.dynamicCounters,
      "uint",
      VSM_DYNAMIC_COUNTER_COUNT,
    ).toAtomic();
    const groupIndirect = bucket
      ? storage(
          bucket.groupIndirectAttribute,
          "uint",
          bucket.groupCount * 4,
        ).toAtomic()
      : undefined;
    const groupCount = bucket?.groupCount ?? 0;
    const node = Fn(() => {
      If(instanceIndex.equal(0), () => {
        for (let index = 0; index < VSM_DYNAMIC_COUNTER_COUNT; index++)
          atomicStore(dynamicCounters.element(index), 0);
        for (let group = 0; group < groupCount; group++)
          if (groupIndirect)
            atomicStore(groupIndirect.element(group * 4 + 1), 0);
      });
      const activeCount = atomicLoad(counters.element(VSM_COUNTER_ACTIVE));
      If(instanceIndex.lessThan(activeCount), () => {
        const pageKey = this.pageJobsNode.element(
          instanceIndex.add(VSM_JOBS_ACTIVE),
        ).x;
        const page = context.pageTableNode.element(pageKey);
        page.assign(uvec4(page.x, 0, page.z, context.frame));
      });
    })().compute(VSM_POOL_CAPACITY, [64]);
    node.name = "VSM dynamic prepare";
    return node;
  }

  private createTouchNode(bucket?: RigidCasterBucket) {
    const rangesAttribute =
      bucket?.pageRangesAttribute ?? this.emptyRangesAttribute;
    const ranges = storage(rangesAttribute, "uvec4", rangesAttribute.count);
    const counters = storage(
      this.context.counters,
      "uint",
      VSM_COUNTER_COUNT,
    ).toAtomic();
    const dynamicCounters = storage(
      this.context.dynamicCounters,
      "uint",
      VSM_DYNAMIC_COUNTER_COUNT,
    ).toAtomic();
    const casterCount = bucket?.casterCount ?? 0;
    const node = Fn(() => {
      const activeCount = atomicLoad(counters.element(VSM_COUNTER_ACTIVE));
      If(instanceIndex.lessThan(activeCount), () => {
        const job = this.pageJobsNode.element(
          instanceIndex.add(VSM_JOBS_ACTIVE),
        );
        const level = job.x.div(VSM_PAGES_PER_LEVEL);
        If(this.isPageTouched(job, level, ranges, casterCount), () => {
          atomicAdd(
            dynamicCounters.element(
              level.add(VSM_DYNAMIC_COUNTER_LEVEL_COUNTS),
            ),
            1,
          );
        });
      });
    })().compute(VSM_POOL_CAPACITY, [64]);
    node.name = "VSM dynamic touch";
    return node;
  }

  private createJobsNode(bucket?: RigidCasterBucket) {
    const { context } = this;
    const rangesAttribute =
      bucket?.pageRangesAttribute ?? this.emptyRangesAttribute;
    const ranges = storage(rangesAttribute, "uvec4", rangesAttribute.count);
    const counters = storage(
      context.counters,
      "uint",
      VSM_COUNTER_COUNT,
    ).toAtomic();
    const dynamicCounters = storage(
      context.dynamicCounters,
      "uint",
      VSM_DYNAMIC_COUNTER_COUNT,
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
    const node = Fn(() => {
      const activeCount = atomicLoad(counters.element(VSM_COUNTER_ACTIVE));
      If(instanceIndex.lessThan(activeCount), () => {
        const job = this.pageJobsNode.element(
          instanceIndex.add(VSM_JOBS_ACTIVE),
        );
        const level = job.x.div(VSM_PAGES_PER_LEVEL).toVar();
        If(this.isPageTouched(job, level, ranges, casterCount), () => {
          const firstSlot = uint(0).toVar();
          Loop(
            { start: uint(0), end: level, type: "uint" },
            ({ i: finerLevel }) => {
              firstSlot.addAssign(
                atomicLoad(
                  dynamicCounters.element(
                    finerLevel.add(VSM_DYNAMIC_COUNTER_LEVEL_COUNTS),
                  ),
                ),
              );
            },
          );
          const levelCount = atomicLoad(
            dynamicCounters.element(
              level.add(VSM_DYNAMIC_COUNTER_LEVEL_COUNTS),
            ),
          );
          If(
            firstSlot.add(levelCount).lessThanEqual(VSM_DYNAMIC_CAPACITY),
            () => {
              const dynamicSlot = atomicAdd(
                dynamicCounters.element(
                  level.add(VSM_DYNAMIC_COUNTER_LEVEL_CURSORS),
                ),
                1,
              )
                .add(firstSlot)
                .toVar();
              atomicAdd(dynamicCounters.element(VSM_DYNAMIC_COUNTER_TOTAL), 1);
              this.pageJobsNode
                .element(dynamicSlot.add(VSM_JOBS_DYNAMIC))
                .assign(uvec4(job.x, dynamicSlot, job.z, job.w));
              context.pageTableNode
                .element(job.x)
                .assign(
                  uvec4(
                    job.y.add(1),
                    context.frame,
                    dynamicSlot,
                    context.frame,
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
            atomicAdd(dynamicCounters.element(VSM_DYNAMIC_COUNTER_OVERFLOW), 1);
            context.pageTableNode
              .element(job.x)
              .assign(uvec4(job.y.add(1), 0, 0, context.frame));
          });
        });
      });
    })().compute(VSM_POOL_CAPACITY, [64]);
    node.name = "VSM dynamic jobs";
    return node;
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
      float(slot.mod(ATLAS_GRID_SIZE)),
      float(slot.div(ATLAS_GRID_SIZE)),
    );
    return tile.add(pageUv).div(ATLAS_GRID_SIZE);
  }

  private getPageUv(
    level: Node<"uint">,
    pageCoordinate: Node<"vec2">,
    worldPosition: Node<"vec3">,
  ) {
    return getLightPosition(worldPosition, this.context.lightBasis)
      .div(getPageSize(level))
      .sub(pageCoordinate.sub(VSM_PAGE_OFFSET));
  }

  private getCasterDepth(worldY: Node<"float">, depthBias: Node<"float">) {
    return this.maximumY
      .sub(worldY)
      .add(depthBias)
      .div(this.maximumY.sub(this.minimumY));
  }

  private createCasterMaterial(bucket: RigidCasterBucket) {
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
      const job = this.pageJobsNode.element(workItem.x.add(VSM_JOBS_DYNAMIC));
      const casterPageUv = this.getPageUv(
        job.x.div(VSM_PAGES_PER_LEVEL),
        vec2(job.z, job.w),
        worldPosition,
      );
      const casterDepth = this.getCasterDepth(
        worldPosition.y,
        depthBiases.element(casterIndex),
      );
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

  private createDeformedCasterMaterial(
    bucket: DeformedCasterBucket,
    caster: VSMCaster,
  ) {
    const { context } = this;
    const material = new MeshBasicNodeMaterial();
    material.depthTest = true;
    material.depthWrite = true;
    material.side = DoubleSide;
    const pageUv = varyingProperty("vec2", "deformedPageUv");
    const depth = varyingProperty("float", "deformedDepth");
    material.vertexNode = Fn(() => {
      const { pageKey, level, instance, pageCoordinate } =
        bucket.getWorkItem(instanceIndex);
      const page = context.pageTableNode.element(pageKey);
      const hasDynamicSlot = page.y.equal(context.frame);
      const worldPosition = bucket.instances.worldPosition(
        instance,
        positionGeometry,
      );
      const casterPageUv = this.getPageUv(level, pageCoordinate, worldPosition);
      const casterDepth = this.getCasterDepth(
        worldPosition.y,
        float(caster.depthBias),
      );
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
      caster.opacity?.(uv()),
      caster.alphaTest,
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
}

class RigidCasterBucket {
  readonly geometries: BufferGeometry[] = [];
  readonly matrixColumnsAttribute: StorageBufferAttribute;
  readonly pageRangesAttribute: StorageBufferAttribute;
  readonly depthBiasAttribute: StorageBufferAttribute;
  readonly workItemsAttribute: StorageBufferAttribute;
  readonly groupIndirectAttribute: IndirectStorageBufferAttribute;
  readonly casterGroupsAttribute: StorageBufferAttribute;
  readonly groupCount: number;
  readonly casterCount: number;
  private matrixValues: Float32Array;
  private rangeValues: Uint32Array;
  private depthBiasValues: Float32Array;
  private bounds = new Box3();
  private corner = new Vector3();

  constructor(sources: VSMCaster[]) {
    this.casterCount = sources.length;
    const groupIndices = new Map<BufferGeometry, number>();
    const casterGroups = new Uint32Array(this.casterCount);
    const groupCasterCounts: number[] = [];
    for (let casterIndex = 0; casterIndex < sources.length; casterIndex++) {
      const source = sources[casterIndex].mesh;
      let groupIndex = groupIndices.get(source.geometry);
      if (groupIndex === undefined) {
        groupIndex = this.geometries.length;
        groupIndices.set(source.geometry, groupIndex);
        groupCasterCounts.push(0);
        const sourceGeometry = source.geometry.index
          ? source.geometry.toNonIndexed()
          : source.geometry;
        const position = sourceGeometry.getAttribute("position");
        if (!position)
          throw new Error(`Shadow caster needs positions: ${source.name}`);
        const positions = new Float32Array(position.count * 3);
        for (let index = 0; index < position.count; index++) {
          positions[index * 3] = position.getX(index);
          positions[index * 3 + 1] = position.getY(index);
          positions[index * 3 + 2] = position.getZ(index);
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute(
          "position",
          new Float32BufferAttribute(positions, 3),
        );
        if (sourceGeometry !== source.geometry) sourceGeometry.dispose();
        this.geometries.push(geometry);
      }
      casterGroups[casterIndex] = groupIndex;
      groupCasterCounts[groupIndex]++;
    }
    this.groupCount = this.geometries.length;
    const indirectValues = new Uint32Array(this.groupCount * 4);
    this.groupIndirectAttribute = new IndirectStorageBufferAttribute(
      indirectValues,
      1,
    );
    let firstItem = 0;
    for (let groupIndex = 0; groupIndex < this.groupCount; groupIndex++) {
      const geometry = this.geometries[groupIndex];
      indirectValues[groupIndex * 4] = geometry.getAttribute("position").count;
      indirectValues[groupIndex * 4 + 3] = firstItem;
      geometry.setIndirect(this.groupIndirectAttribute, [
        groupIndex * 4 * Uint32Array.BYTES_PER_ELEMENT,
      ]);
      firstItem += groupCasterCounts[groupIndex] * VSM_DYNAMIC_CAPACITY;
    }

    this.workItemsAttribute = new StorageBufferAttribute(
      new Uint32Array(firstItem * 2),
      2,
    );
    this.matrixValues = new Float32Array(this.casterCount * 16);
    this.matrixColumnsAttribute = new StorageBufferAttribute(
      this.matrixValues,
      4,
    );
    this.rangeValues = new Uint32Array(this.casterCount * VSM_LEVEL_COUNT * 4);
    this.pageRangesAttribute = new StorageBufferAttribute(this.rangeValues, 4);
    this.depthBiasValues = new Float32Array(this.casterCount);
    this.depthBiasAttribute = new StorageBufferAttribute(
      this.depthBiasValues,
      1,
    );
    this.casterGroupsAttribute = new StorageBufferAttribute(casterGroups, 1);
    for (const geometry of this.geometries) {
      geometry.setAttribute("shadowIndirect", this.groupIndirectAttribute);
      geometry.setAttribute("shadowWorkItems", this.workItemsAttribute);
      geometry.setAttribute("shadowMatrices", this.matrixColumnsAttribute);
      geometry.setAttribute("shadowPageRanges", this.pageRangesAttribute);
      geometry.setAttribute("shadowDepthBiases", this.depthBiasAttribute);
      geometry.setAttribute("shadowCasterGroups", this.casterGroupsAttribute);
    }
  }

  update(sources: VSMCaster[], lightX: Vector3, lightY: Vector3) {
    if (sources.length !== this.casterCount)
      throw new Error(
        "Rigid caster count changed without rebuilding the bucket",
      );

    for (let casterIndex = 0; casterIndex < sources.length; casterIndex++) {
      const { mesh: source, depthBias } = sources[casterIndex];
      this.depthBiasValues[casterIndex] = depthBias;
      source.updateWorldMatrix(true, false);
      this.matrixValues.set(source.matrixWorld.elements, casterIndex * 16);
      this.bounds.setFromObject(source);
      for (let level = 0; level < VSM_LEVEL_COUNT; level++) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let corner = 0; corner < 8; corner++) {
          this.corner.set(
            corner & 1 ? this.bounds.max.x : this.bounds.min.x,
            corner & 2 ? this.bounds.max.y : this.bounds.min.y,
            corner & 4 ? this.bounds.max.z : this.bounds.min.z,
          );
          const page = computePageCoordinate(
            this.corner,
            lightX,
            lightY,
            level,
          );
          minX = Math.min(minX, page.x);
          minY = Math.min(minY, page.y);
          maxX = Math.max(maxX, page.x);
          maxY = Math.max(maxY, page.y);
        }
        this.rangeValues.set(
          [minX, minY, maxX, maxY],
          (casterIndex * VSM_LEVEL_COUNT + level) * 4,
        );
      }
    }
    this.matrixColumnsAttribute.needsUpdate = true;
    this.pageRangesAttribute.needsUpdate = true;
    this.depthBiasAttribute.needsUpdate = true;
  }

  dispose() {
    for (const geometry of this.geometries) geometry.dispose();
  }
}

class DeformedCasterBucket {
  readonly geometry: BufferGeometry;
  readonly workItemsAttribute = new StorageBufferAttribute(
    new Uint32Array(MAX_DEFORMED_WORK_ITEMS * 4),
    4,
  );
  readonly indirectAttribute: IndirectStorageBufferAttribute;
  readonly instances: VSMGpuInstances;
  private resetNode;
  private buildNode;

  constructor(context: VSMContext, source: Mesh, instances: VSMGpuInstances) {
    this.instances = instances;
    this.geometry = instances.geometry
      ? new BufferGeometry().copy(instances.geometry)
      : source.geometry.clone();
    const position = this.geometry.getAttribute("position");
    if (!position) throw new Error("Deformed shadow caster needs positions");
    const indirect = new IndirectStorageBufferAttribute(
      this.geometry.index
        ? new Uint32Array([this.geometry.index.count, 0, 0, 0, 0])
        : new Uint32Array([position.count, 0, 0, 0]),
      1,
    );
    this.indirectAttribute = indirect;
    this.geometry.setIndirect(indirect);
    this.geometry.setAttribute("shadowIndirect", indirect);
    this.geometry.setAttribute("shadowWorkItems", this.workItemsAttribute);
    const indirectNode = storage(indirect, "uint", indirect.count).toAtomic();
    const workItems = storage(
      this.workItemsAttribute,
      "uvec4",
      MAX_DEFORMED_WORK_ITEMS,
    );

    this.resetNode = Fn(() => {
      atomicStore(indirectNode.element(1), 0);
    })().compute(1, [1]);

    this.buildNode = Fn(() => {
      If(instances.isActive(instanceIndex), () => {
        const base = instances.baseWorldPosition(instanceIndex);
        const height = instances.height(instanceIndex);
        const lightBase = getLightPosition(base, context.lightBasis);
        const lightTop = getLightPosition(
          base.add(vec3(0, height, 0)),
          context.lightBasis,
        );
        const minimum = lightBase.min(lightTop).sub(instances.radiusMeters);
        const maximum = lightBase.max(lightTop).add(instances.radiusMeters);
        const distance = base.sub(context.cameraPosition).length();
        const reach = height.add(instances.radiusMeters);
        const firstLevel = getReceiverLevel(
          distance.sub(reach).max(0),
          bool(false),
        );
        const lastLevel = getReceiverLevel(distance.add(reach), bool(true));
        Loop(
          { start: firstLevel, end: lastLevel.add(1), type: "uint" },
          ({ i: levelIndex }) => {
            const level = levelIndex.toVar();
            const pageSize = getPageSize(level);
            const firstPage = getPageCoordinate(minimum.div(pageSize));
            const lastPage = getPageCoordinate(maximum.div(pageSize));
            const pageWidth = lastPage.x.sub(firstPage.x).add(1);
            const pageCount = pageWidth.mul(lastPage.y.sub(firstPage.y).add(1));
            Loop(
              { start: 0, end: pageCount, type: "uint" },
              ({ i: pageLoopIndex }) => {
                const pageCoordinate = firstPage.add(
                  uvec2(
                    pageLoopIndex.mod(pageWidth),
                    pageLoopIndex.div(pageWidth),
                  ),
                );
                const pageKey = getPageKey(level, pageCoordinate);
                const { slot, isResident } = context.resolvePage(
                  pageKey,
                  getPageTag(pageCoordinate),
                );
                const isActive = context.pageTableNode
                  .element(pageKey)
                  .w.equal(context.frame);
                If(isResident.and(isActive), () => {
                  const itemIndex = atomicAdd(indirectNode.element(1), 1);
                  If(itemIndex.lessThan(MAX_DEFORMED_WORK_ITEMS), () => {
                    workItems
                      .element(itemIndex)
                      .assign(uvec4(pageKey, instanceIndex, pageCoordinate));
                    context.pageTableNode
                      .element(pageKey)
                      .assign(
                        uvec4(slot.add(1), context.frame, 0, context.frame),
                      );
                  }).Else(() => {
                    atomicSub(indirectNode.element(1), 1);
                  });
                });
              },
            );
          },
        );
      });
    })().compute(instances.count, [64]);
    this.resetNode.name = "VSM deformed reset";
    this.buildNode.name = "VSM deformed work";
  }

  get computeNodes() {
    return [this.resetNode, this.buildNode];
  }

  getWorkItem(index: Node<"uint">) {
    const workItem = storage(
      this.workItemsAttribute,
      "uvec4",
      MAX_DEFORMED_WORK_ITEMS,
    ).element(index);
    return {
      pageKey: workItem.x,
      level: workItem.x.div(VSM_PAGES_PER_LEVEL),
      instance: workItem.y,
      pageCoordinate: workItem.zw.toVec2(),
    };
  }

  dispose() {
    this.geometry.dispose();
    this.resetNode.dispose();
    this.buildNode.dispose();
  }
}

class InstanceRasterSource implements VSMRasterSource {
  readonly hasUvs: boolean;
  private context: VSMContext;
  private instances: VSMGpuInstances;
  private depthBias: number;
  private clusterCount: number;
  private workCount;
  private workItems;
  private pageTable;
  private positions;
  private clusterTriangles;
  private uvs;

  constructor(
    context: VSMContext,
    bucket: DeformedCasterBucket,
    caster: VSMCaster,
  ) {
    const { geometry } = bucket;
    this.context = context;
    this.instances = bucket.instances;
    this.depthBias = caster.depthBias;
    this.hasUvs = caster.opacity !== undefined;
    const positions: number[] = [];
    const uvs: number[] = [];
    const clusterBounds: number[] = [];
    const clusterTriangles: number[] = [];
    const { clusterCount } = appendGeometryClusters(
      geometry,
      {
        start: 0,
        count: geometry.index
          ? geometry.index.count
          : geometry.getAttribute("position").count,
      },
      positions,
      this.hasUvs ? uvs : undefined,
      clusterBounds,
      clusterTriangles,
    );
    this.clusterCount = clusterCount;
    const positionsAttribute = new StorageBufferAttribute(
      new Float32Array(positions),
      4,
    );
    const clusterTrianglesAttribute = new StorageBufferAttribute(
      new Uint32Array(clusterTriangles),
      1,
    );
    this.positions = storage(
      positionsAttribute,
      "vec4",
      positionsAttribute.count,
    ).toReadOnly();
    this.clusterTriangles = storage(
      clusterTrianglesAttribute,
      "uint",
      clusterTrianglesAttribute.count,
    ).toReadOnly();
    this.uvs = this.hasUvs
      ? storage(
          new StorageBufferAttribute(new Float32Array(uvs), 2),
          "vec2",
          uvs.length / 2,
        ).toReadOnly()
      : undefined;
    this.workCount = storage(
      bucket.indirectAttribute,
      "uint",
      bucket.indirectAttribute.count,
    ).toReadOnly();
    this.workItems = storage(
      bucket.workItemsAttribute,
      "uvec4",
      MAX_DEFORMED_WORK_ITEMS,
    ).toReadOnly();
    this.pageTable = storage(
      context.pageTable,
      "uvec4",
      VSM_PAGE_COUNT,
    ).toReadOnly();
  }

  getWorkCount() {
    const count = this.workCount.element(1);
    return count
      .lessThan(MAX_DEFORMED_WORK_ITEMS)
      .select(count, uint(MAX_DEFORMED_WORK_ITEMS))
      .mul(this.clusterCount);
  }

  getWork(index: Node<"uint">): VSMRasterWork {
    const cluster = index.mod(this.clusterCount).toVar();
    const workItem = this.workItems
      .element(index.div(this.clusterCount))
      .toVar();
    const page = this.pageTable.element(workItem.x).toVar();
    return {
      slot: page.z,
      level: workItem.x.div(VSM_PAGES_PER_LEVEL),
      pageCoordinate: workItem.zw,
      firstVertex: cluster.mul(VSM_CLUSTER_VERTICES),
      triangleCount: page.y
        .equal(this.context.frame)
        .select(this.clusterTriangles.element(cluster), uint(0)),
      instance: workItem.y,
    };
  }

  getCorner(work: VSMRasterWork, vertex: Node<"uint">) {
    return vec4(
      this.instances.worldPosition(
        work.instance,
        this.positions.element(vertex).xyz,
      ),
      this.depthBias,
    );
  }

  getUv(vertex: Node<"uint">) {
    return this.uvs ? this.uvs.element(vertex) : vec2(0);
  }
}
