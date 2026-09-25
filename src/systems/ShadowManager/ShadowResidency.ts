import { Vector2, Vector3 } from "three";
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
  Break,
  Fn,
  If,
  ivec2,
  Loop,
  storage,
  uint,
  uniform,
  uvec2,
  uvec4,
} from "three/tsl";
import type { ShadowPageStats } from "../EventsManager";
import {
  SHADOW_PAGE_COUNT,
  SHADOW_PAGE_GRID_MIN,
  SHADOW_PAGE_GRID_SIZE,
  SHADOW_PAGES_PER_LEVEL,
  ShadowPageCoordinates,
} from "./ShadowPageCoordinates";
import type { ShadowPageRequests } from "./ShadowPageRequests";

const POOL_CAPACITY = 96;
const SEARCH_WIDTH = 16;
const INVALID_PAGE_KEY = 0xffffffff;
const INVALID_SLOT = 0xffffffff;
const READBACK_INTERVAL_MS = 1000;

const priorityOffsets: { x: number; y: number }[] = [];
for (let y = -SEARCH_WIDTH / 2; y < SEARCH_WIDTH / 2; y++) {
  for (let x = -SEARCH_WIDTH / 2; x < SEARCH_WIDTH / 2; x++) {
    priorityOffsets.push({ x, y });
  }
}
priorityOffsets.sort((a, b) => a.x * a.x + a.y * a.y - b.x * b.x - b.y * b.y);
const offsetData = new Int32Array(priorityOffsets.length * 2);
for (let index = 0; index < priorityOffsets.length; index++) {
  offsetData[index * 2] = priorityOffsets[index].x;
  offsetData[index * 2 + 1] = priorityOffsets[index].y;
}

const initialMetadata = new Uint32Array(POOL_CAPACITY * 4);
for (let slot = 0; slot < POOL_CAPACITY; slot++)
  initialMetadata[slot * 4] = INVALID_PAGE_KEY;

export class ShadowResidency {
  private renderer: WebGPURenderer;
  private coordinates = new ShadowPageCoordinates();
  private previousSunDirection = new Vector3();
  private nearCenter = uniform(new Vector2());
  private farCenter = uniform(new Vector2());
  private frame = uniform(0, "uint");
  private sunGeneration = uniform(1, "uint");
  private offsets = new StorageBufferAttribute(offsetData, 2);
  private offsetsNode = storage(this.offsets, "ivec2", priorityOffsets.length);
  private pageTable = new StorageBufferAttribute(
    new Uint32Array(SHADOW_PAGE_COUNT * 4),
    4,
  );
  private pageTableNode = storage(this.pageTable, "uvec4", SHADOW_PAGE_COUNT);
  private slotMetadata = new StorageBufferAttribute(initialMetadata, 4);
  private slotMetadataNode = storage(this.slotMetadata, "uvec4", POOL_CAPACITY);
  private pageJobs = new StorageBufferAttribute(
    new Uint32Array(POOL_CAPACITY * 4),
    2,
  );
  private pageJobsNode = storage(this.pageJobs, "uvec2", POOL_CAPACITY * 2);
  private counters = new StorageBufferAttribute(new Uint32Array(8), 1);
  private atomicCounters = storage(this.counters, "uint", 8).toAtomic();
  private atlasIndirect = new IndirectStorageBufferAttribute(
    new Uint32Array([6, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0]),
    1,
  );
  private atomicAtlasIndirect = storage(
    this.atlasIndirect,
    "uint",
    8,
  ).toAtomic();
  private allocateNode;
  private isReadbackPending = false;
  private nextReadbackTime = 0;
  readonly stats: ShadowPageStats = {
    requested: 0,
    nearRequested: 0,
    farRequested: 0,
    mapped: 0,
    allocated: 0,
    evicted: 0,
    missing: 0,
    outsideGrid: 0,
  };

  constructor(renderer: WebGPURenderer, requests: ShadowPageRequests) {
    this.renderer = renderer;
    const requestBits = storage(
      requests.bitsAttribute,
      "uint",
      requests.bitsAttribute.count,
    ).toAtomic();
    const requestCounters = storage(requests.countersAttribute, "uint", 4);

    this.allocateNode = Fn(() => {
      Loop({ start: 0, end: 4, type: "uint" }, ({ i: index }) => {
        atomicStore(this.atomicCounters.element(index), 0);
      });
      atomicStore(this.atomicAtlasIndirect.element(9), 0);

      for (const levelIndex of [0, 1]) {
        const level = uint(levelIndex);
        const center = level
          .equal(uint(0))
          .select(this.nearCenter, this.farCenter);
        Loop(
          { start: 0, end: priorityOffsets.length, type: "uint" },
          ({ i: offsetIndex }) => {
            const pageId = this.offsetsNode
              .element(offsetIndex)
              .add(ivec2(center));
            const isInsideGrid = pageId.x
              .greaterThanEqual(SHADOW_PAGE_GRID_MIN)
              .and(
                pageId.x.lessThan(SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE),
              )
              .and(pageId.y.greaterThanEqual(SHADOW_PAGE_GRID_MIN))
              .and(
                pageId.y.lessThan(SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE),
              );
            If(isInsideGrid, () => {
              const pageKey = level.mul(SHADOW_PAGES_PER_LEVEL).add(
                uint(pageId.y.sub(SHADOW_PAGE_GRID_MIN))
                  .mul(SHADOW_PAGE_GRID_SIZE)
                  .add(uint(pageId.x.sub(SHADOW_PAGE_GRID_MIN))),
              );
              const bit = uint(1).shiftLeft(pageKey.mod(32));
              const hasRequest = atomicLoad(
                requestBits.element(pageKey.div(32)),
              )
                .bitAnd(bit)
                .notEqual(0);
              If(hasRequest, () => {
                const activeSlot = uint(INVALID_SLOT).toVar();
                const entry = this.pageTableNode.element(pageKey).toVar();
                const slotPlusOne = entry.x;
                const slot = slotPlusOne
                  .greaterThan(0)
                  .and(slotPlusOne.lessThanEqual(POOL_CAPACITY))
                  .select(slotPlusOne.sub(1), uint(0));
                const metadata = this.slotMetadataNode.element(slot).toVar();
                const isHit = slotPlusOne
                  .greaterThan(0)
                  .and(slotPlusOne.lessThanEqual(POOL_CAPACITY))
                  .and(metadata.x.equal(pageKey))
                  .and(metadata.y.equal(entry.y))
                  .and(entry.z.equal(this.sunGeneration));

                If(isHit, () => {
                  activeSlot.assign(slot);
                  this.slotMetadataNode
                    .element(slot)
                    .assign(
                      uvec4(metadata.x, metadata.y, this.frame, this.frame),
                    );
                  atomicAdd(this.atomicCounters.element(0), 1);
                  atomicAdd(this.atomicCounters.element(3), 1);
                }).Else(() => {
                  const selectedSlot = uint(INVALID_SLOT).toVar();
                  const oldestFrame = uint(INVALID_SLOT).toVar();
                  Loop(
                    { start: 0, end: POOL_CAPACITY, type: "uint" },
                    ({ i: candidateSlot }) => {
                      const candidate =
                        this.slotMetadataNode.element(candidateSlot);
                      If(candidate.x.equal(INVALID_PAGE_KEY), () => {
                        selectedSlot.assign(candidateSlot);
                        Break();
                      });
                      If(
                        candidate.w
                          .notEqual(this.frame)
                          .and(candidate.z.lessThan(oldestFrame)),
                        () => {
                          selectedSlot.assign(candidateSlot);
                          oldestFrame.assign(candidate.z);
                        },
                      );
                    },
                  );

                  If(selectedSlot.notEqual(INVALID_SLOT), () => {
                    activeSlot.assign(selectedSlot);
                    const oldMetadata = this.slotMetadataNode
                      .element(selectedSlot)
                      .toVar();
                    If(oldMetadata.x.notEqual(INVALID_PAGE_KEY), () => {
                      this.pageTableNode
                        .element(oldMetadata.x)
                        .assign(uvec4(0));
                      atomicAdd(this.atomicCounters.element(2), 1);
                    });
                    const nextGeneration = oldMetadata.y.add(1);
                    const generation = nextGeneration
                      .equal(0)
                      .select(uint(1), nextGeneration);
                    this.slotMetadataNode
                      .element(selectedSlot)
                      .assign(
                        uvec4(pageKey, generation, this.frame, this.frame),
                      );
                    this.pageTableNode
                      .element(pageKey)
                      .assign(
                        uvec4(
                          selectedSlot.add(1),
                          generation,
                          this.sunGeneration,
                          uint(0),
                        ),
                      );
                    const jobIndex = atomicAdd(
                      this.atomicCounters.element(1),
                      1,
                    );
                    this.pageJobsNode
                      .element(jobIndex)
                      .assign(uvec2(pageKey, selectedSlot));
                    atomicAdd(this.atomicCounters.element(3), 1);
                  });
                });
                If(activeSlot.notEqual(INVALID_SLOT), () => {
                  const jobIndex = atomicAdd(
                    this.atomicAtlasIndirect.element(9),
                    1,
                  );
                  this.pageJobsNode
                    .element(jobIndex.add(POOL_CAPACITY))
                    .assign(uvec2(pageKey, activeSlot));
                });
              });
            });
          },
        );
      }
      for (let index = 0; index < 4; index++) {
        atomicStore(
          this.atomicCounters.element(index + 4),
          requestCounters.element(index),
        );
      }
      atomicStore(
        this.atomicAtlasIndirect.element(1),
        atomicLoad(this.atomicCounters.element(1)),
      );
      atomicStore(
        this.atomicAtlasIndirect.element(5),
        atomicLoad(this.atomicCounters.element(1)),
      );
      atomicStore(
        this.atomicAtlasIndirect.element(13),
        atomicLoad(this.atomicAtlasIndirect.element(9)),
      );
    })().compute(1, [1]);
    this.allocateNode.name = "V2 page residency";
  }

  get capacity() {
    return POOL_CAPACITY;
  }

  get pageJobsAttribute() {
    return this.pageJobs;
  }

  get counterAttribute() {
    return this.counters;
  }

  get clearIndirectAttribute() {
    return this.atlasIndirect;
  }

  get fixedIndirectAttribute() {
    return this.atlasIndirect;
  }

  get movingIndirectAttribute() {
    return this.atlasIndirect;
  }

  setFixedVertexCount(vertexCount: number) {
    this.atlasIndirect.array[4] = vertexCount;
    this.atlasIndirect.needsUpdate = true;
  }

  setMovingVertexCount(vertexCount: number) {
    this.atlasIndirect.array[12] = vertexCount;
    this.atlasIndirect.needsUpdate = true;
  }

  invalidate() {
    this.sunGeneration.value = (this.sunGeneration.value + 1) >>> 0;
    if (this.sunGeneration.value === 0) this.sunGeneration.value = 1;
  }

  resolvePage(pageKey: Node<"uint">) {
    const entry = this.pageTableNode.element(pageKey);
    const slotPlusOne = entry.x;
    const slot = slotPlusOne
      .greaterThan(0)
      .and(slotPlusOne.lessThanEqual(POOL_CAPACITY))
      .select(slotPlusOne.sub(1), uint(0));
    const metadata = this.slotMetadataNode.element(slot);
    const isResident = slotPlusOne
      .greaterThan(0)
      .and(slotPlusOne.lessThanEqual(POOL_CAPACITY))
      .and(metadata.x.equal(pageKey))
      .and(metadata.y.equal(entry.y))
      .and(entry.z.equal(this.sunGeneration));
    const isActive = isResident.and(metadata.w.equal(this.frame));
    return { slot, isResident, isActive };
  }

  run(cameraPosition: Vector3, sunDirection: Vector3) {
    this.frame.value = (this.frame.value + 1) >>> 0;
    if (!this.previousSunDirection.equals(sunDirection)) {
      this.previousSunDirection.copy(sunDirection);
      this.invalidate();
    }
    const nearCenter = this.coordinates.getPageCenter(
      cameraPosition,
      sunDirection,
      0,
    );
    const farCenter = this.coordinates.getPageCenter(
      cameraPosition,
      sunDirection,
      1,
    );
    this.nearCenter.value.set(nearCenter.x, nearCenter.y);
    this.farCenter.value.set(farCenter.x, farCenter.y);
    this.renderer.compute(this.allocateNode);

    const now = performance.now();
    if (this.isReadbackPending || now < this.nextReadbackTime) return;
    this.isReadbackPending = true;
    this.nextReadbackTime = now + READBACK_INTERVAL_MS;
    void this.refreshStatsAsync();
  }

  private async refreshStatsAsync() {
    try {
      const residencyBuffer = await this.renderer.getArrayBufferAsync(
        this.counters,
      );
      const metadataBuffer = await this.renderer.getArrayBufferAsync(
        this.slotMetadata,
      );
      const residency = new Uint32Array(residencyBuffer);
      const metadata = new Uint32Array(metadataBuffer);
      let mapped = 0;
      for (let slot = 0; slot < POOL_CAPACITY; slot++) {
        if (metadata[slot * 4] !== INVALID_PAGE_KEY) mapped++;
      }
      this.stats.requested = residency[4];
      this.stats.nearRequested = residency[5];
      this.stats.farRequested = residency[6];
      this.stats.outsideGrid = residency[7];
      this.stats.mapped = mapped;
      this.stats.allocated = residency[1];
      this.stats.evicted = residency[2];
      this.stats.missing = Math.max(0, residency[4] - residency[3]);
    } catch (error) {
      console.error("Shadow page stats readback failed", error);
    } finally {
      this.isReadbackPending = false;
    }
  }
}
