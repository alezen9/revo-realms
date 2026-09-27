import { Box3, Mesh, Vector3, type BufferGeometry } from "three";
import {
  StorageBufferAttribute,
  type ComputeNode,
  type Node,
  type StorageBufferNode,
} from "three/webgpu";
import {
  atomicAdd,
  atomicLoad,
  atomicStore,
  atomicSub,
  float,
  Fn,
  If,
  instanceIndex,
  Loop,
  storage,
  uint,
  uvec2,
  uvec4,
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
  VSM_PAGES_PER_LEVEL,
  computePageCoordinate,
  getLightPosition,
  getPageCoordinate,
  getPageKey,
  getPageSize,
  getPageTag,
  getReceiverLevel,
} from "./VSMMath";

const MAX_INSTANCE_WORK_ITEMS = 262144;

export class VSMDynamicLayer {
  readonly pool: VSMDepthPool;
  private context: VSMContext;
  private pageJobsNode;
  private sources: VSMCaster[] = [];
  private movingRanges?: MovingCasterRanges;
  private instanceCasters = new Map<Mesh, InstanceCaster>();
  private activeInstanceCasters: InstanceCaster[] = [];
  private prepareNode?: ComputeNode;
  private touchNode?: ComputeNode;
  private jobsNode?: ComputeNode;
  private emptyRangesAttribute = new StorageBufferAttribute(
    new Uint32Array(4),
    4,
  );

  constructor(context: VSMContext) {
    this.context = context;
    this.pageJobsNode = storage(context.pageJobs, "uvec4", VSM_JOB_COUNT);
    this.pool = new VSMDepthPool(context, {
      kind: "moving",
      capacity: VSM_DYNAMIC_CAPACITY,
      jobs: context.dynamicJobs,
      depthBiasTexels: 3,
    });
  }

  sync(terrainBounds: { min: number; max: number }) {
    const { changes } = this.context;
    const { hasRosterChanged, hasCasterMoved } = changes.moving;
    if (!hasRosterChanged && !hasCasterMoved && !changes.hasSunChanged) return;

    if (hasRosterChanged) this.rebuildCasters();
    this.pool.sync(terrainBounds);
    const { x: lightX, y: lightY } = this.context.lightBasis;
    this.movingRanges?.update(this.sources, lightX.value, lightY.value);
  }

  getComputeNodes() {
    const nodes: ComputeNode[] = [];
    if (this.prepareNode) nodes.push(this.prepareNode);
    for (const caster of this.activeInstanceCasters)
      nodes.push(...caster.computeNodes);
    if (this.touchNode && this.jobsNode)
      nodes.push(this.touchNode, this.jobsNode);
    nodes.push(...this.pool.getComputeNodes());
    return nodes;
  }

  private rebuildCasters() {
    this.sources = [];
    this.activeInstanceCasters = [];
    for (const caster of this.context.casters) {
      if (caster.gpuInstances) {
        let instanceCaster = this.instanceCasters.get(caster.mesh);
        if (!instanceCaster) {
          instanceCaster = new InstanceCaster(this.context, caster);
          this.instanceCasters.set(caster.mesh, instanceCaster);
        }
        this.activeInstanceCasters.push(instanceCaster);
        continue;
      }
      if (caster.kind === "moving") this.sources.push(caster);
    }
    this.pool.setInstanceCasters(
      this.activeInstanceCasters.map((instanceCaster) =>
        instanceCaster.toRasterCaster(),
      ),
    );
    this.movingRanges =
      this.sources.length > 0
        ? new MovingCasterRanges(this.sources.length)
        : undefined;
    this.prepareNode?.dispose();
    this.touchNode?.dispose();
    this.jobsNode?.dispose();
    this.prepareNode = this.createPrepareNode();
    this.touchNode = this.createTouchNode(this.movingRanges);
    this.jobsNode = this.createJobsNode(this.movingRanges);
  }

  private createPrepareNode() {
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
    const node = Fn(() => {
      If(instanceIndex.equal(0), () => {
        for (let index = 0; index < VSM_DYNAMIC_COUNTER_COUNT; index++)
          atomicStore(dynamicCounters.element(index), 0);
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

  private createTouchNode(ranges?: MovingCasterRanges) {
    const rangesAttribute =
      ranges?.pageRangesAttribute ?? this.emptyRangesAttribute;
    const rangesNode = storage(rangesAttribute, "uvec4", rangesAttribute.count);
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
    const casterCount = ranges?.casterCount ?? 0;
    const node = Fn(() => {
      const activeCount = atomicLoad(counters.element(VSM_COUNTER_ACTIVE));
      If(instanceIndex.lessThan(activeCount), () => {
        const job = this.pageJobsNode.element(
          instanceIndex.add(VSM_JOBS_ACTIVE),
        );
        const level = job.x.div(VSM_PAGES_PER_LEVEL);
        If(this.isPageTouched(job, level, rangesNode, casterCount), () => {
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

  private createJobsNode(ranges?: MovingCasterRanges) {
    const { context } = this;
    const rangesAttribute =
      ranges?.pageRangesAttribute ?? this.emptyRangesAttribute;
    const rangesNode = storage(rangesAttribute, "uvec4", rangesAttribute.count);
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
    const casterCount = ranges?.casterCount ?? 0;
    const node = Fn(() => {
      const activeCount = atomicLoad(counters.element(VSM_COUNTER_ACTIVE));
      If(instanceIndex.lessThan(activeCount), () => {
        const job = this.pageJobsNode.element(
          instanceIndex.add(VSM_JOBS_ACTIVE),
        );
        const level = job.x.div(VSM_PAGES_PER_LEVEL).toVar();
        If(this.isPageTouched(job, level, rangesNode, casterCount), () => {
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
}

class MovingCasterRanges {
  readonly pageRangesAttribute: StorageBufferAttribute;
  readonly casterCount: number;
  private rangeValues: Uint32Array;
  private bounds = new Box3();
  private corner = new Vector3();

  constructor(casterCount: number) {
    this.casterCount = casterCount;
    this.rangeValues = new Uint32Array(casterCount * VSM_LEVEL_COUNT * 4);
    this.pageRangesAttribute = new StorageBufferAttribute(this.rangeValues, 4);
  }

  update(sources: VSMCaster[], lightX: Vector3, lightY: Vector3) {
    if (sources.length !== this.casterCount)
      throw new Error(
        "Moving caster count changed without rebuilding the ranges",
      );

    for (let casterIndex = 0; casterIndex < sources.length; casterIndex++) {
      const { mesh } = sources[casterIndex];
      mesh.updateWorldMatrix(true, false);
      this.bounds.setFromObject(mesh);
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
    this.pageRangesAttribute.needsUpdate = true;
  }
}

class InstanceCaster implements VSMRasterSource {
  readonly hasUvs: boolean;
  private context: VSMContext;
  private caster: VSMCaster;
  private instances: VSMGpuInstances;
  private clusterCount: number;
  private workCount;
  private workItems;
  private pageTable;
  private positions;
  private clusterTriangles;
  private uvs;
  private resetNode;
  private buildNode;

  constructor(context: VSMContext, caster: VSMCaster) {
    const { gpuInstances: instances, mesh } = caster;
    if (!instances) throw new Error(`Missing gpu instances: ${mesh.name}`);
    const geometry: BufferGeometry = instances.geometry ?? mesh.geometry;
    this.context = context;
    this.caster = caster;
    this.instances = instances;
    this.hasUvs = caster.opacity !== undefined;
    const positions: number[] = [];
    const uvs: number[] = [];
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
      [],
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
    const workCountAttribute = new StorageBufferAttribute(
      new Uint32Array(1),
      1,
    );
    const workItemsAttribute = new StorageBufferAttribute(
      new Uint32Array(MAX_INSTANCE_WORK_ITEMS * 4),
      4,
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
    this.workCount = storage(workCountAttribute, "uint", 1).toReadOnly();
    this.workItems = storage(
      workItemsAttribute,
      "uvec4",
      MAX_INSTANCE_WORK_ITEMS,
    ).toReadOnly();
    this.pageTable = storage(
      context.pageTable,
      "uvec4",
      VSM_PAGE_COUNT,
    ).toReadOnly();
    const workCountNode = storage(workCountAttribute, "uint", 1).toAtomic();
    const workItems = storage(
      workItemsAttribute,
      "uvec4",
      MAX_INSTANCE_WORK_ITEMS,
    );

    this.resetNode = Fn(() => {
      atomicStore(workCountNode.element(0), 0);
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
          float(0),
        );
        const lastLevel = getReceiverLevel(distance.add(reach), float(1));
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
                  const itemIndex = atomicAdd(workCountNode.element(0), 1);
                  If(itemIndex.lessThan(MAX_INSTANCE_WORK_ITEMS), () => {
                    workItems
                      .element(itemIndex)
                      .assign(uvec4(pageKey, instanceIndex, pageCoordinate));
                    context.pageTableNode
                      .element(pageKey)
                      .assign(
                        uvec4(slot.add(1), context.frame, 0, context.frame),
                      );
                  }).Else(() => {
                    atomicSub(workCountNode.element(0), 1);
                  });
                });
              },
            );
          },
        );
      });
    })().compute(instances.count, [64]);
    this.resetNode.name = "VSM instance reset";
    this.buildNode.name = "VSM instance work";
  }

  get computeNodes() {
    return [this.resetNode, this.buildNode];
  }

  toRasterCaster() {
    const { alphaTest, opacity } = this.caster;
    return { source: this, alphaTest, opacity };
  }

  getWorkCount() {
    const count = this.workCount.element(0);
    return count
      .lessThan(MAX_INSTANCE_WORK_ITEMS)
      .select(count, uint(MAX_INSTANCE_WORK_ITEMS))
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
      this.caster.depthBias,
    );
  }

  getUv(vertex: Node<"uint">) {
    return this.uvs ? this.uvs.element(vertex) : vec2(0);
  }
}
