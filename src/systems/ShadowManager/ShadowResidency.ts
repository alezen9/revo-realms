import { StorageBufferAttribute, type WebGPURenderer } from "three/webgpu";
import {
  atomicAdd,
  atomicLoad,
  atomicStore,
  Break,
  Fn,
  If,
  instanceIndex,
  Loop,
  storage,
  uint,
  uvec2,
  uvec4,
} from "three/tsl";
import { shadowConfig } from "./config";
import {
  SHADOW_REQUESTED_PAGE_COUNTER,
  SHADOW_VIRTUAL_PAGE_COUNT,
} from "./ShadowPageRequests";
import { updateShadowResidencyTelemetry } from "./telemetry";

const INVALID_PAGE_KEY = 0xffffffff;
const INVALID_SLOT = 0xffffffff;
const RESIDENT_COUNTER = 0;
const ALLOCATED_COUNTER = 1;
const EVICTED_COUNTER = 2;
const MISSING_COUNTER = 3;
const STALE_COUNTER = 4;
const HIT_COUNTER = 5;
const MISS_COUNTER = 6;
const FRAME_COUNTER = 7;
const CLOCK_COUNTER = 8;
const COUNTER_COUNT = 9;
const FIRST_FRAME_COUNTER = ALLOCATED_COUNTER;
const LAST_FRAME_COUNTER = MISS_COUNTER;
const READBACK_INTERVAL_MS = 1_000;

const createSlotMetadata = () => {
  const metadata = new Uint32Array(shadowConfig.poolCapacity * 4);
  for (let slot = 0; slot < shadowConfig.poolCapacity; slot++)
    metadata[slot * 4] = INVALID_PAGE_KEY;
  return metadata;
};

export class ShadowResidency {
  private renderer: WebGPURenderer;
  private requestListNode;
  private requestCountersNode;
  private pageTable = new StorageBufferAttribute(
    new Uint32Array(SHADOW_VIRTUAL_PAGE_COUNT * 2),
    2,
  );
  private slotMetadata = new StorageBufferAttribute(createSlotMetadata(), 4);
  private counters = new StorageBufferAttribute(
    new Uint32Array(COUNTER_COUNT),
    1,
  );
  private pageTableNode = storage(
    this.pageTable,
    "uvec2",
    this.pageTable.count,
  );
  private slotMetadataNode = storage(
    this.slotMetadata,
    "uvec4",
    this.slotMetadata.count,
  );
  private atomicCounters = storage(
    this.counters,
    "uint",
    this.counters.count,
  ).toAtomic();
  private resetNode;
  private allocateNode;
  private validateNode;
  private isReadbackPending = false;
  private nextReadbackTime = 0;

  constructor(
    renderer: WebGPURenderer,
    requestList: StorageBufferAttribute,
    requestCounters: StorageBufferAttribute,
  ) {
    this.renderer = renderer;
    this.requestListNode = storage(requestList, "uint", requestList.count);
    this.requestCountersNode = storage(
      requestCounters,
      "uint",
      requestCounters.count,
    );
    const nodes = this.createComputeNodes(requestList.count);
    this.resetNode = nodes.reset;
    this.allocateNode = nodes.allocate;
    this.validateNode = nodes.validate;
  }

  run() {
    this.renderer.compute(this.resetNode);
    this.renderer.compute(this.allocateNode);
    this.renderer.compute(this.validateNode);

    const now = performance.now();
    if (this.isReadbackPending || now < this.nextReadbackTime) return;
    this.nextReadbackTime = now + READBACK_INTERVAL_MS;
    this.isReadbackPending = true;
    void this.refreshTelemetryAsync();
  }

  private createComputeNodes(requestCapacity: number) {
    const reset = Fn(() => {
      const counterIndex = instanceIndex.add(FIRST_FRAME_COUNTER);
      If(counterIndex.lessThanEqual(LAST_FRAME_COUNTER), () => {
        atomicStore(this.atomicCounters.element(counterIndex), 0);
      });
    })().compute(LAST_FRAME_COUNTER - FIRST_FRAME_COUNTER + 1, [
      LAST_FRAME_COUNTER - FIRST_FRAME_COUNTER + 1,
    ]);

    const allocate = Fn(() => {
      const frame = atomicAdd(
        this.atomicCounters.element(FRAME_COUNTER),
        1,
      ).add(1);
      const requestedCount = this.requestCountersNode
        .element(SHADOW_REQUESTED_PAGE_COUNTER)
        .min(uint(requestCapacity));

      Loop(
        { start: 0, end: requestedCount, type: "uint" },
        ({ i: requestIndex }) => {
          // atomic append order is not stable across GPU executions
          const originalPageKey = this.requestListNode
            .element(requestIndex)
            .toVar();
          const pageKey = originalPageKey.toVar();
          const selectedRequestIndex = requestIndex.toVar();
          Loop(
            {
              start: requestIndex.add(1),
              end: requestedCount,
              type: "uint",
            },
            ({ i: candidateIndex }) => {
              const candidatePageKey =
                this.requestListNode.element(candidateIndex);
              If(candidatePageKey.lessThan(pageKey), () => {
                pageKey.assign(candidatePageKey);
                selectedRequestIndex.assign(candidateIndex);
              });
            },
          );
          this.requestListNode
            .element(selectedRequestIndex)
            .assign(originalPageKey);
          this.requestListNode.element(requestIndex).assign(pageKey);
          if (shadowConfig.isResidencyChurnEnabled)
            pageKey.assign(
              pageKey.add(frame.mul(257)).mod(uint(SHADOW_VIRTUAL_PAGE_COUNT)),
            );
          const pageEntry = this.pageTableNode.element(pageKey).toVar();
          const slotPlusOne = pageEntry.x;
          const hasMapping = slotPlusOne.greaterThan(0);
          const isHit = uint(0).toVar();

          If(hasMapping, () => {
            const slot = slotPlusOne.sub(1);
            const slotMetadata = this.slotMetadataNode.element(slot).toVar();
            const isValid = slotMetadata.x
              .equal(pageKey)
              .and(slotMetadata.y.equal(pageEntry.y));
            If(isValid, () => {
              isHit.assign(1);
              this.slotMetadataNode
                .element(slot)
                .assign(uvec4(slotMetadata.x, slotMetadata.y, frame, frame));
              atomicAdd(this.atomicCounters.element(HIT_COUNTER), 1);
            }).Else(() => {
              this.pageTableNode.element(pageKey).assign(uvec2(0));
              atomicAdd(this.atomicCounters.element(STALE_COUNTER), 1);
            });
          });

          If(isHit.equal(0), () => {
            atomicAdd(this.atomicCounters.element(MISS_COUNTER), 1);
            const selectedSlot = uint(INVALID_SLOT).toVar();

            Loop(
              { start: 0, end: shadowConfig.poolCapacity, type: "uint" },
              ({ i: slot }) => {
                If(
                  this.slotMetadataNode.element(slot).x.equal(INVALID_PAGE_KEY),
                  () => {
                    selectedSlot.assign(slot);
                    Break();
                  },
                );
              },
            );

            If(selectedSlot.equal(INVALID_SLOT), () => {
              const clock = atomicLoad(
                this.atomicCounters.element(CLOCK_COUNTER),
              );
              Loop(
                { start: 0, end: shadowConfig.poolCapacity, type: "uint" },
                ({ i: offset }) => {
                  const slot = clock.add(offset).mod(shadowConfig.poolCapacity);
                  If(
                    this.slotMetadataNode.element(slot).w.notEqual(frame),
                    () => {
                      selectedSlot.assign(slot);
                      Break();
                    },
                  );
                },
              );
            });

            If(selectedSlot.equal(INVALID_SLOT), () => {
              atomicAdd(this.atomicCounters.element(MISSING_COUNTER), 1);
            }).Else(() => {
              const oldMetadata = this.slotMetadataNode
                .element(selectedSlot)
                .toVar();
              const oldPageKey = oldMetadata.x;
              If(oldPageKey.equal(INVALID_PAGE_KEY), () => {
                atomicAdd(this.atomicCounters.element(RESIDENT_COUNTER), 1);
              }).Else(() => {
                this.pageTableNode.element(oldPageKey).assign(uvec2(0));
                atomicAdd(this.atomicCounters.element(EVICTED_COUNTER), 1);
              });

              const generation = oldMetadata.y.add(1).toVar();
              If(generation.equal(0), () => {
                generation.assign(1);
              });
              this.slotMetadataNode
                .element(selectedSlot)
                .assign(uvec4(pageKey, generation, frame, frame));
              this.pageTableNode
                .element(pageKey)
                .assign(uvec2(selectedSlot.add(1), generation));
              atomicStore(
                this.atomicCounters.element(CLOCK_COUNTER),
                selectedSlot.add(1).mod(shadowConfig.poolCapacity),
              );
              atomicAdd(this.atomicCounters.element(ALLOCATED_COUNTER), 1);
            });
          });
        },
      );
    })().compute(1, [1]);

    const validate = Fn(() => {
      const pageKey = instanceIndex;
      const pageEntry = this.pageTableNode.element(pageKey).toVar();
      const slotPlusOne = pageEntry.x;
      If(slotPlusOne.greaterThan(0), () => {
        const slot = slotPlusOne.sub(1);
        const slotMetadata = this.slotMetadataNode.element(slot);
        const isValid = slotMetadata.x
          .equal(pageKey)
          .and(slotMetadata.y.equal(pageEntry.y));
        If(isValid.not(), () => {
          this.pageTableNode.element(pageKey).assign(uvec2(0));
          atomicAdd(this.atomicCounters.element(STALE_COUNTER), 1);
        });
      });
    })().compute(SHADOW_VIRTUAL_PAGE_COUNT, [64]);

    reset.name = "Shadow residency reset";
    allocate.name = "Shadow residency allocation";
    validate.name = "Shadow residency validation";
    return { reset, allocate, validate };
  }

  private async refreshTelemetryAsync() {
    try {
      const buffer = await this.renderer.getArrayBufferAsync(this.counters);
      const counters = new Uint32Array(buffer);
      updateShadowResidencyTelemetry({
        residentPages: counters[RESIDENT_COUNTER],
        allocatedPages: counters[ALLOCATED_COUNTER],
        evictedPages: counters[EVICTED_COUNTER],
        missingPages: counters[MISSING_COUNTER],
        stalePages: counters[STALE_COUNTER],
        cacheHits: counters[HIT_COUNTER],
        cacheMisses: counters[MISS_COUNTER],
      });
    } catch (error) {
      console.error("[Shadow residency] telemetry readback failed:", error);
    } finally {
      this.isReadbackPending = false;
    }
  }
}
