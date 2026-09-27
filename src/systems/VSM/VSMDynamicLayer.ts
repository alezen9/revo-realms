import { Box3, Vector3 } from "three";
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
  Fn,
  If,
  instanceIndex,
  Loop,
  storage,
  uint,
  uvec4,
} from "three/tsl";
import {
  VSM_COUNTER_ACTIVE,
  VSM_COUNTER_COUNT,
  VSM_DYNAMIC_CAPACITY,
  VSM_DYNAMIC_COUNTER_COUNT,
  VSM_DYNAMIC_COUNTER_LEVEL_COUNTS,
  VSM_DYNAMIC_COUNTER_LEVEL_CURSORS,
  VSM_DYNAMIC_COUNTER_TOTAL,
  VSM_JOB_COUNT,
  VSM_JOBS_ACTIVE,
  VSM_JOBS_DYNAMIC,
  VSM_POOL_CAPACITY,
  type VSMCaster,
  type VSMContext,
} from "./VSMContext";
import { VSMDepthPool } from "./VSMDepthPool";
import {
  VSM_LEVEL_COUNT,
  VSM_PAGES_PER_LEVEL,
  computePageCoordinate,
} from "./VSMMath";

export class VSMDynamicLayer {
  readonly pool: VSMDepthPool;
  private context: VSMContext;
  private pageJobsNode;
  private sources: VSMCaster[] = [];
  private casterRanges?: DynamicCasterRanges;
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
      kind: "dynamic",
      capacity: VSM_DYNAMIC_CAPACITY,
      jobs: context.dynamicJobs,
      depthBiasTexels: 3,
    });
  }

  sync(terrainBounds: { min: number; max: number }) {
    const { changes } = this.context;
    const { hasRosterChanged, hasCasterMoved } = changes.dynamic;
    if (!hasRosterChanged && !hasCasterMoved && !changes.hasSunChanged) return;

    if (hasRosterChanged) this.rebuildCasters();
    this.pool.sync(terrainBounds);
    const { x: lightX, y: lightY } = this.context.lightBasis;
    this.casterRanges?.update(this.sources, lightX.value, lightY.value);
  }

  collectComputeNodes(nodes: ComputeNode[]) {
    if (this.prepareNode) nodes.push(this.prepareNode);
    if (this.touchNode && this.jobsNode)
      nodes.push(this.touchNode, this.jobsNode);
    this.pool.collectComputeNodes(nodes);
  }

  private rebuildCasters() {
    this.sources = [];
    for (const caster of this.context.casters)
      if (caster.type === "dynamic") this.sources.push(caster);
    this.casterRanges =
      this.sources.length > 0
        ? new DynamicCasterRanges(this.sources.length)
        : undefined;
    this.prepareNode?.dispose();
    this.touchNode?.dispose();
    this.jobsNode?.dispose();
    this.prepareNode = this.createPrepareNode();
    this.touchNode = this.createTouchNode(this.casterRanges);
    this.jobsNode = this.createJobsNode(this.casterRanges);
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

  private createTouchNode(ranges?: DynamicCasterRanges) {
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

  private createJobsNode(ranges?: DynamicCasterRanges) {
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

class DynamicCasterRanges {
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
        "Dynamic caster count changed without rebuilding the ranges",
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
        const rangeOffset = (casterIndex * VSM_LEVEL_COUNT + level) * 4;
        this.rangeValues[rangeOffset] = minX;
        this.rangeValues[rangeOffset + 1] = minY;
        this.rangeValues[rangeOffset + 2] = maxX;
        this.rangeValues[rangeOffset + 3] = maxY;
      }
    }
    this.pageRangesAttribute.needsUpdate = true;
  }
}
