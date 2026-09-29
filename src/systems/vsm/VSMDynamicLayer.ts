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
  type VSMContext,
} from "./VSMContext";
import { VSMDepthPool } from "./VSMDepthPool";
import { VSM_PAGES_PER_LEVEL } from "./VSMMath";

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
  frame: Node<"uint">,
];

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

// dynamic clusters stamp the active pages they cover with this frame
const countTouchedPages = Fn<DynamicJobArgs, void>(
  ([counters, dynamicCounters, pageJobs, pageTable, frame]) => {
    const activeCount = atomicLoad(counters.element(VSM_COUNTER_ACTIVE));
    If(instanceIndex.lessThan(activeCount), () => {
      const job = pageJobs.element(instanceIndex.add(VSM_JOBS_ACTIVE));
      const level = job.x.div(VSM_PAGES_PER_LEVEL);
      const isTouched = pageTable.element(job.x).y.equal(frame);
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
  ([counters, dynamicCounters, pageJobs, pageTable, frame]) => {
    const activeCount = atomicLoad(counters.element(VSM_COUNTER_ACTIVE));
    If(instanceIndex.lessThan(activeCount), () => {
      const job = pageJobs.element(instanceIndex.add(VSM_JOBS_ACTIVE));
      const level = job.x.div(VSM_PAGES_PER_LEVEL).toVar();
      const isTouched = pageTable.element(job.x).y.equal(frame);
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
  private prepareNode: ComputeNode;
  private touchNode: ComputeNode;
  private jobsNode: ComputeNode;

  constructor(context: VSMContext) {
    this.pool = new VSMDepthPool(context, {
      kind: "dynamic",
      capacity: VSM_DYNAMIC_CAPACITY,
      jobs: context.dynamicJobs,
      depthBiasTexels: 3,
    });

    const counters = createCounterNode(context.counters, VSM_COUNTER_COUNT);
    const dynamicCounters = createCounterNode(
      context.dynamicCounters,
      VSM_DYNAMIC_COUNTER_COUNT,
    );
    const pageJobs = createUvec4Node(context.pageJobs, VSM_JOB_COUNT);
    const { pageTableNode: pageTable, frame } = context;
    const jobArgs: DynamicJobArgs = [
      counters,
      dynamicCounters,
      pageJobs,
      pageTable,
      frame,
    ];
    const workgroup = [64];

    this.prepareNode = prepareDynamicPages(
      counters,
      dynamicCounters,
      pageJobs,
      pageTable,
      frame,
    ).compute(VSM_POOL_CAPACITY, workgroup);
    this.prepareNode.name = "VSM dynamic prepare";
    this.touchNode = countTouchedPages(...jobArgs).compute(
      VSM_POOL_CAPACITY,
      workgroup,
    );
    this.touchNode.name = "VSM dynamic touch";
    this.jobsNode = assignDynamicSlots(...jobArgs).compute(
      VSM_POOL_CAPACITY,
      workgroup,
    );
    this.jobsNode.name = "VSM dynamic jobs";
  }

  sync(terrainBounds: { min: number; max: number }) {
    this.pool.sync(terrainBounds);
  }

  // clusters mark their pages before the touch pass, their shape can come from the gpu
  collectComputeNodes(nodes: ComputeNode[]) {
    nodes.push(this.prepareNode);
    this.pool.collectBoundsNodes(nodes);
    nodes.push(this.touchNode, this.jobsNode);
    this.pool.collectRasterNodes(nodes);
  }
}
