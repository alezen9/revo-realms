import { Box3, Vector3 } from "three";
import {
  StorageBufferAttribute,
  type ComputeNode,
  type Node,
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

const createCounterNode = (attribute: StorageBufferAttribute, count: number) =>
  storage(attribute, "uint", count).toAtomic();
const createUvec4Node = (attribute: StorageBufferAttribute, count: number) =>
  storage(attribute, "uvec4", count);

type CounterNode = ReturnType<typeof createCounterNode>;
type Uvec4Node = ReturnType<typeof createUvec4Node>;

type DynamicJobArgs = [
  counters: CounterNode,
  dynamicCounters: CounterNode,
  pageJobs: Uvec4Node,
  pageTable: Uvec4Node,
  casterRanges: Uvec4Node,
  casterCount: Node<"uint">,
  frame: Node<"uint">,
];

const isCasterOnPage = (range: Node<"uvec4">, job: Node<"uvec4">) =>
  job.z
    .greaterThanEqual(range.x)
    .and(job.w.greaterThanEqual(range.y))
    .and(job.z.lessThanEqual(range.z))
    .and(job.w.lessThanEqual(range.w));

const isPageTouched = (
  job: Node<"uvec4">,
  level: Node<"uint">,
  pageTable: Uvec4Node,
  casterRanges: Uvec4Node,
  casterCount: Node<"uint">,
  frame: Node<"uint">,
) => {
  const isTouched = pageTable.element(job.x).y.equal(frame).toVar();
  Loop({ start: 0, end: casterCount, type: "uint" }, ({ i: casterIndex }) => {
    const range = casterRanges.element(
      casterIndex.mul(VSM_LEVEL_COUNT).add(level),
    );
    isTouched.assign(isTouched.or(isCasterOnPage(range, job)));
  });
  return isTouched;
};

const prepareDynamicPages = Fn<
  [
    counters: CounterNode,
    dynamicCounters: CounterNode,
    pageJobs: Uvec4Node,
    pageTable: Uvec4Node,
    frame: Node<"uint">,
  ],
  void
>(([counters, dynamicCounters, pageJobs, pageTable, frame]) => {
  If(instanceIndex.equal(0), () => {
    for (let index = 0; index < VSM_DYNAMIC_COUNTER_COUNT; index++)
      atomicStore(dynamicCounters.element(index), 0);
  });
  const activeCount = atomicLoad(counters.element(VSM_COUNTER_ACTIVE));
  If(instanceIndex.lessThan(activeCount), () => {
    const pageKey = pageJobs.element(instanceIndex.add(VSM_JOBS_ACTIVE)).x;
    const page = pageTable.element(pageKey);
    page.assign(uvec4(page.x, 0, page.z, frame));
  });
});

const countTouchedPages = Fn<DynamicJobArgs, void>(
  ([
    counters,
    dynamicCounters,
    pageJobs,
    pageTable,
    casterRanges,
    casterCount,
    frame,
  ]) => {
    const activeCount = atomicLoad(counters.element(VSM_COUNTER_ACTIVE));
    If(instanceIndex.lessThan(activeCount), () => {
      const job = pageJobs.element(instanceIndex.add(VSM_JOBS_ACTIVE));
      const level = job.x.div(VSM_PAGES_PER_LEVEL);
      const isTouched = isPageTouched(
        job,
        level,
        pageTable,
        casterRanges,
        casterCount,
        frame,
      );
      If(isTouched, () => {
        const levelCount = dynamicCounters.element(
          level.add(VSM_DYNAMIC_COUNTER_LEVEL_COUNTS),
        );
        atomicAdd(levelCount, 1);
      });
    });
  },
);

const assignDynamicSlots = Fn<DynamicJobArgs, void>(
  ([
    counters,
    dynamicCounters,
    pageJobs,
    pageTable,
    casterRanges,
    casterCount,
    frame,
  ]) => {
    const activeCount = atomicLoad(counters.element(VSM_COUNTER_ACTIVE));
    If(instanceIndex.lessThan(activeCount), () => {
      const job = pageJobs.element(instanceIndex.add(VSM_JOBS_ACTIVE));
      const level = job.x.div(VSM_PAGES_PER_LEVEL).toVar();
      const isTouched = isPageTouched(
        job,
        level,
        pageTable,
        casterRanges,
        casterCount,
        frame,
      );
      If(isTouched, () => {
        // finer levels take the first slots so a full pool drops the coarse ones
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
          dynamicCounters.element(level.add(VSM_DYNAMIC_COUNTER_LEVEL_COUNTS)),
        );
        const hasRoomForLevel = firstSlot
          .add(levelCount)
          .lessThanEqual(VSM_DYNAMIC_CAPACITY);
        If(hasRoomForLevel, () => {
          const levelCursor = dynamicCounters.element(
            level.add(VSM_DYNAMIC_COUNTER_LEVEL_CURSORS),
          );
          const dynamicSlot = atomicAdd(levelCursor, 1).add(firstSlot).toVar();
          atomicAdd(dynamicCounters.element(VSM_DYNAMIC_COUNTER_TOTAL), 1);
          pageJobs
            .element(dynamicSlot.add(VSM_JOBS_DYNAMIC))
            .assign(uvec4(job.x, dynamicSlot, job.z, job.w));
          pageTable
            .element(job.x)
            .assign(uvec4(job.y.add(1), frame, dynamicSlot, frame));
        }).Else(() => {
          pageTable.element(job.x).assign(uvec4(job.y.add(1), 0, 0, frame));
        });
      });
    });
  },
);

export class VSMDynamicLayer {
  readonly pool: VSMDepthPool;
  private context: VSMContext;
  private sources: VSMCaster[] = [];
  private casterRanges = new DynamicCasterRanges(0);
  private computeNodes: ComputeNode[] = [];

  constructor(context: VSMContext) {
    this.context = context;
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
    this.casterRanges.update(this.sources, lightX.value, lightY.value);
  }

  collectComputeNodes(nodes: ComputeNode[]) {
    nodes.push(...this.computeNodes);
    this.pool.collectComputeNodes(nodes);
  }

  private rebuildCasters() {
    const { context } = this;
    this.sources = [];
    for (const caster of context.casters)
      if (caster.type === "dynamic") this.sources.push(caster);
    this.casterRanges = new DynamicCasterRanges(this.sources.length);
    for (const node of this.computeNodes) node.dispose();

    const counters = createCounterNode(context.counters, VSM_COUNTER_COUNT);
    const dynamicCounters = createCounterNode(
      context.dynamicCounters,
      VSM_DYNAMIC_COUNTER_COUNT,
    );
    const pageJobs = createUvec4Node(context.pageJobs, VSM_JOB_COUNT);
    const { pageRangesAttribute, casterCount } = this.casterRanges;
    const casterRanges = createUvec4Node(
      pageRangesAttribute,
      pageRangesAttribute.count,
    );
    const { pageTableNode: pageTable, frame } = context;
    const jobArgs: DynamicJobArgs = [
      counters,
      dynamicCounters,
      pageJobs,
      pageTable,
      casterRanges,
      uint(casterCount),
      frame,
    ];
    const workgroup = [64];

    const prepareNode = prepareDynamicPages(
      counters,
      dynamicCounters,
      pageJobs,
      pageTable,
      frame,
    ).compute(VSM_POOL_CAPACITY, workgroup);
    prepareNode.name = "VSM dynamic prepare";
    const touchNode = countTouchedPages(...jobArgs).compute(
      VSM_POOL_CAPACITY,
      workgroup,
    );
    touchNode.name = "VSM dynamic touch";
    const jobsNode = assignDynamicSlots(...jobArgs).compute(
      VSM_POOL_CAPACITY,
      workgroup,
    );
    jobsNode.name = "VSM dynamic jobs";
    this.computeNodes = [prepareNode, touchNode, jobsNode];
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
    // storage buffers can't be empty, so an empty roster keeps one range
    const allocatedCount = Math.max(casterCount, 1);
    this.rangeValues = new Uint32Array(allocatedCount * VSM_LEVEL_COUNT * 4);
    this.pageRangesAttribute = new StorageBufferAttribute(this.rangeValues, 4);
  }

  update(sources: VSMCaster[], lightX: Vector3, lightY: Vector3) {
    if (sources.length !== this.casterCount)
      throw new Error(
        "Dynamic caster count changed without rebuilding the ranges",
      );

    const { min, max } = this.bounds;
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
          const cornerX = corner & 1 ? max.x : min.x;
          const cornerY = corner & 2 ? max.y : min.y;
          const cornerZ = corner & 4 ? max.z : min.z;
          this.corner.set(cornerX, cornerY, cornerZ);
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
