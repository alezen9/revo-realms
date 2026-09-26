import { Vector3 } from "three";
import {
  IndirectStorageBufferAttribute,
  StorageBufferAttribute,
  type Node,
  type WebGPURenderer,
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
  uniform,
  uvec4,
} from "three/tsl";
import type { ShadowPageStats } from "../EventsManager";
import {
  SHADOW_LEVEL_COUNT,
  SHADOW_PAGE_COUNT,
  SHADOW_PAGES_PER_LEVEL,
  getShadowPageTag,
  getShadowWindowCenter,
  getShadowWindowPage,
} from "./ShadowPageCoordinates";
import type { ShadowPageRequests } from "./ShadowPageRequests";

const POOL_CAPACITY = 1024;
const DYNAMIC_CAPACITY = 256;
const INVALID_PAGE_KEY = 0xffffffff;
const READBACK_INTERVAL_MS = 1000;
const REQUEST_WORD_COUNT = SHADOW_PAGE_COUNT / 32;
const EMPTY_LIST_OFFSET = SHADOW_LEVEL_COUNT * POOL_CAPACITY;
const REUSABLE_LIST_OFFSET = EMPTY_LIST_OFFSET + POOL_CAPACITY;
const LIST_SIZE = REUSABLE_LIST_OFFSET + POOL_CAPACITY;
const COUNTER_REQUESTED = 0;
const COUNTER_ALLOCATED = 1;
const COUNTER_EVICTED = 2;
const COUNTER_MISSING = 3;
const COUNTER_ACTIVE = 4;
const COUNTER_EMPTY = 5;
const COUNTER_REUSABLE = 6;
const COUNTER_LEVEL_MISSES = 7;
const COUNTER_COUNT = COUNTER_LEVEL_MISSES + SHADOW_LEVEL_COUNT;

const initialMetadata = new Uint32Array(POOL_CAPACITY * 4);
for (let slot = 0; slot < POOL_CAPACITY; slot++)
  initialMetadata[slot * 4] = INVALID_PAGE_KEY;

export class ShadowResidency {
  readonly frame = uniform(0, "uint");
  readonly cameraPosition: Node<"vec3">;
  private renderer: WebGPURenderer;
  private previousSunDirection = new Vector3();
  private sunGeneration = uniform(1, "uint");
  private pageTable = new StorageBufferAttribute(
    new Uint32Array(SHADOW_PAGE_COUNT * 4),
    4,
  );
  readonly pageTableNode = storage(this.pageTable, "uvec4", SHADOW_PAGE_COUNT);
  private slotMetadata = new StorageBufferAttribute(initialMetadata, 4);
  private slotMetadataNode = storage(this.slotMetadata, "uvec4", POOL_CAPACITY);
  private lists = new StorageBufferAttribute(new Uint32Array(LIST_SIZE), 1);
  private listsNode = storage(this.lists, "uint", LIST_SIZE);
  private pageJobs = new StorageBufferAttribute(
    new Uint32Array(POOL_CAPACITY * 3 * 4),
    4,
  );
  private pageJobsNode = storage(this.pageJobs, "uvec4", POOL_CAPACITY * 3);
  private counters = new StorageBufferAttribute(
    new Uint32Array(COUNTER_COUNT),
    1,
  );
  private atomicCounters = storage(
    this.counters,
    "uint",
    COUNTER_COUNT,
  ).toAtomic();
  private atlasIndirect = new IndirectStorageBufferAttribute(
    new Uint32Array([6, 0, 0, 0, 6, 0, 0, 0]),
    1,
  );
  private atomicAtlasIndirect = storage(
    this.atlasIndirect,
    "uint",
    8,
  ).toAtomic();
  private resetNode;
  private collectNode;
  private freeNode;
  private allocateNode;
  private isReadbackPending = false;
  private hasPendingWork = true;
  private nextReadbackTime = 0;
  readonly stats: ShadowPageStats = {
    requested: 0,
    mapped: 0,
    allocated: 0,
    dynamic: 0,
    evicted: 0,
    missing: 0,
    outsideGrid: 0,
  };
  private requestCounters: StorageBufferAttribute;

  constructor(
    renderer: WebGPURenderer,
    requests: ShadowPageRequests,
    cameraPosition: Node<"vec3">,
    sunDirection: Node<"vec3">,
  ) {
    this.renderer = renderer;
    this.cameraPosition = cameraPosition;
    this.requestCounters = requests.countersAttribute;
    const requestBits = storage(
      requests.bitsAttribute,
      "uint",
      requests.bitsAttribute.count,
    ).toAtomic();

    this.resetNode = Fn(() => {
      Loop({ start: 0, end: COUNTER_COUNT, type: "uint" }, ({ i: index }) => {
        atomicStore(this.atomicCounters.element(index), 0);
      });
      for (const index of [1])
        atomicStore(this.atomicAtlasIndirect.element(index), 0);
    })().compute(1, [1]);

    this.collectNode = Fn(() => {
      const word = atomicLoad(requestBits.element(instanceIndex));
      If(word.notEqual(0), () => {
        Loop({ start: 0, end: 32, type: "uint" }, ({ i: bitIndex }) => {
          If(word.shiftRight(bitIndex).bitAnd(1).notEqual(0), () => {
            const pageKey = instanceIndex.mul(32).add(bitIndex);
            const level = pageKey.div(SHADOW_PAGES_PER_LEVEL);
            const pageCoordinate = getShadowWindowPage(
              pageKey,
              getShadowWindowCenter(cameraPosition, sunDirection, level),
            );
            const pageTag = getShadowPageTag(pageCoordinate);
            const { slot, isResident } = this.resolvePage(pageKey, pageTag);
            atomicAdd(this.atomicCounters.element(COUNTER_REQUESTED), 1);
            If(isResident, () => {
              this.slotMetadataNode
                .element(slot)
                .assign(
                  uvec4(pageKey, pageTag, this.frame, this.sunGeneration),
                );
              const activeIndex = atomicAdd(
                this.atomicCounters.element(COUNTER_ACTIVE),
                1,
              );
              this.pageJobsNode
                .element(activeIndex.add(POOL_CAPACITY))
                .assign(uvec4(pageKey, slot, pageCoordinate));
            }).Else(() => {
              const missIndex = atomicAdd(
                this.atomicCounters.element(level.add(COUNTER_LEVEL_MISSES)),
                1,
              );
              If(missIndex.lessThan(POOL_CAPACITY), () => {
                this.listsNode
                  .element(level.mul(POOL_CAPACITY).add(missIndex))
                  .assign(pageKey);
              });
            });
          });
        });
      });
    })().compute(REQUEST_WORD_COUNT, [64]);

    this.freeNode = Fn(() => {
      const metadata = this.slotMetadataNode.element(instanceIndex);
      If(metadata.z.notEqual(this.frame), () => {
        If(
          metadata.x
            .equal(INVALID_PAGE_KEY)
            .or(metadata.w.notEqual(this.sunGeneration)),
          () => {
            const index = atomicAdd(
              this.atomicCounters.element(COUNTER_EMPTY),
              1,
            );
            this.listsNode
              .element(index.add(EMPTY_LIST_OFFSET))
              .assign(instanceIndex);
          },
        ).Else(() => {
          const index = atomicAdd(
            this.atomicCounters.element(COUNTER_REUSABLE),
            1,
          );
          this.listsNode
            .element(index.add(REUSABLE_LIST_OFFSET))
            .assign(instanceIndex);
        });
      });
    })().compute(POOL_CAPACITY, [64]);

    this.allocateNode = Fn(() => {
      const level = instanceIndex.div(POOL_CAPACITY);
      const missIndex = instanceIndex.mod(POOL_CAPACITY);
      const levelMisses = atomicLoad(
        this.atomicCounters.element(level.add(COUNTER_LEVEL_MISSES)),
      );
      If(missIndex.lessThan(levelMisses), () => {
        const rank = missIndex.toVar();
        Loop({ start: uint(0), end: level, type: "uint" }, ({ i: finer }) => {
          const finerMisses = atomicLoad(
            this.atomicCounters.element(finer.add(COUNTER_LEVEL_MISSES)),
          );
          rank.addAssign(
            finerMisses
              .lessThan(POOL_CAPACITY)
              .select(finerMisses, uint(POOL_CAPACITY)),
          );
        });
        const emptyCount = atomicLoad(
          this.atomicCounters.element(COUNTER_EMPTY),
        );
        const reusableCount = atomicLoad(
          this.atomicCounters.element(COUNTER_REUSABLE),
        );
        If(rank.lessThan(emptyCount.add(reusableCount)), () => {
          const isEmpty = rank.lessThan(emptyCount);
          const slot = this.listsNode
            .element(
              isEmpty.select(
                rank.add(EMPTY_LIST_OFFSET),
                rank.sub(emptyCount).add(REUSABLE_LIST_OFFSET),
              ),
            )
            .toVar();
          const pageKey = this.listsNode
            .element(level.mul(POOL_CAPACITY).add(missIndex))
            .toVar();
          const pageCoordinate = getShadowWindowPage(
            pageKey,
            getShadowWindowCenter(cameraPosition, sunDirection, level),
          );
          this.slotMetadataNode
            .element(slot)
            .assign(
              uvec4(
                pageKey,
                getShadowPageTag(pageCoordinate),
                this.frame,
                this.sunGeneration,
              ),
            );
          this.pageTableNode
            .element(pageKey)
            .assign(uvec4(slot.add(1), 0, 0, 0));
          const job = uvec4(pageKey, slot, pageCoordinate);
          const jobIndex = atomicAdd(this.atomicAtlasIndirect.element(1), 1);
          this.pageJobsNode.element(jobIndex).assign(job);
          const activeIndex = atomicAdd(
            this.atomicCounters.element(COUNTER_ACTIVE),
            1,
          );
          this.pageJobsNode.element(activeIndex.add(POOL_CAPACITY)).assign(job);
          atomicAdd(this.atomicCounters.element(COUNTER_ALLOCATED), 1);
          If(isEmpty.not(), () => {
            atomicAdd(this.atomicCounters.element(COUNTER_EVICTED), 1);
          });
        }).Else(() => {
          atomicAdd(this.atomicCounters.element(COUNTER_MISSING), 1);
        });
      });
    })().compute(SHADOW_LEVEL_COUNT * POOL_CAPACITY, [64]);

    this.resetNode.name = "V2 page residency reset";
    this.collectNode.name = "V2 page residency collect";
    this.freeNode.name = "V2 page residency free";
    this.allocateNode.name = "V2 page residency allocate";
  }

  get capacity() {
    return POOL_CAPACITY;
  }

  get dynamicCapacity() {
    return DYNAMIC_CAPACITY;
  }

  get pageJobsAttribute() {
    return this.pageJobs;
  }

  get counterAttribute() {
    return this.counters;
  }

  get activeCountIndex() {
    return COUNTER_ACTIVE;
  }

  get atlasIndirectAttribute() {
    return this.atlasIndirect;
  }

  invalidate() {
    this.sunGeneration.value = (this.sunGeneration.value + 1) >>> 0;
    if (this.sunGeneration.value === 0) this.sunGeneration.value = 1;
    this.hasPendingWork = true;
  }

  resolvePage(pageKey: Node<"uint">, pageTag: Node<"uint">) {
    const entry = this.pageTableNode.element(pageKey);
    const slotPlusOne = entry.x;
    const hasSlot = slotPlusOne
      .greaterThan(0)
      .and(slotPlusOne.lessThanEqual(POOL_CAPACITY));
    const slot = hasSlot.select(slotPlusOne.sub(1), uint(0));
    const metadata = this.slotMetadataNode.element(slot);
    const isResident = hasSlot
      .and(metadata.x.equal(pageKey))
      .and(metadata.y.equal(pageTag))
      .and(metadata.w.equal(this.sunGeneration));
    const hasDynamic = isResident.and(entry.y.equal(this.frame));
    return { slot, isResident, hasDynamic, dynamicSlot: entry.z };
  }

  run(sunDirection: Vector3, hasNewRequests: boolean) {
    this.frame.value = (this.frame.value + 1) >>> 0;
    if (!this.previousSunDirection.equals(sunDirection)) {
      this.previousSunDirection.copy(sunDirection);
      this.invalidate();
    }
    if (!hasNewRequests && !this.hasPendingWork && this.stats.missing === 0)
      return false;
    this.hasPendingWork = false;
    this.renderer.compute(this.resetNode);
    this.renderer.compute(this.collectNode);
    this.renderer.compute(this.freeNode);
    this.renderer.compute(this.allocateNode);

    const now = performance.now();
    if (!this.isReadbackPending && now >= this.nextReadbackTime) {
      this.isReadbackPending = true;
      this.nextReadbackTime = now + READBACK_INTERVAL_MS;
      void this.refreshStatsAsync();
    }
    return true;
  }

  private async refreshStatsAsync() {
    try {
      const residency = new Uint32Array(
        await this.renderer.getArrayBufferAsync(this.counters),
      );
      const requests = new Uint32Array(
        await this.renderer.getArrayBufferAsync(this.requestCounters),
      );
      const metadata = new Uint32Array(
        await this.renderer.getArrayBufferAsync(this.slotMetadata),
      );
      const atlasIndirect = new Uint32Array(
        await this.renderer.getArrayBufferAsync(this.atlasIndirect),
      );
      let mapped = 0;
      for (let slot = 0; slot < POOL_CAPACITY; slot++) {
        if (
          metadata[slot * 4] !== INVALID_PAGE_KEY &&
          metadata[slot * 4 + 3] === this.sunGeneration.value
        )
          mapped++;
      }
      this.stats.requested = residency[COUNTER_REQUESTED];
      this.stats.outsideGrid = requests[1];
      this.stats.mapped = mapped;
      this.stats.allocated = residency[COUNTER_ALLOCATED];
      this.stats.dynamic = atlasIndirect[5];
      this.stats.evicted = residency[COUNTER_EVICTED];
      let overflow = 0;
      for (let level = 0; level < SHADOW_LEVEL_COUNT; level++)
        overflow += Math.max(
          0,
          residency[COUNTER_LEVEL_MISSES + level] - POOL_CAPACITY,
        );
      this.stats.missing = residency[COUNTER_MISSING] + overflow;
    } catch (error) {
      console.error("Shadow page stats readback failed", error);
    } finally {
      this.isReadbackPending = false;
    }
  }
}
