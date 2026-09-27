import { Vector2, Vector3, type Box3, type Texture } from "three";
import {
  StorageBufferAttribute,
  type ComputeNode,
  type Node,
  type TextureNode,
  type WebGPURenderer,
} from "three/webgpu";
import {
  atomicAdd,
  atomicLoad,
  atomicOr,
  atomicStore,
  Fn,
  getViewPosition,
  globalId,
  If,
  instanceIndex,
  Loop,
  storage,
  texture,
  textureLoad,
  uint,
  uniform,
  uvec2,
  uvec4,
  vec2,
  vec4,
} from "three/tsl";
import type { ShadowPageStats } from "../EventsManager";
import {
  VSM_COUNTER_ACTIVE,
  VSM_COUNTER_ALLOCATED,
  VSM_COUNTER_COUNT,
  VSM_COUNTER_EMPTY,
  VSM_COUNTER_LEVEL_MISSES,
  VSM_COUNTER_MISSING,
  VSM_COUNTER_REQUESTED,
  VSM_COUNTER_REUSABLE,
  VSM_DYNAMIC_COUNTER_TOTAL,
  VSM_INVALID_PAGE_KEY,
  VSM_JOB_COUNT,
  VSM_JOBS_ACTIVE,
  VSM_JOBS_ALLOCATED,
  VSM_POOL_CAPACITY,
  type VSMContext,
} from "./VSMContext";
import {
  VSM_LEVEL_COUNT,
  VSM_PAGE_COUNT,
  VSM_PAGE_TEXELS,
  VSM_PAGES_PER_LEVEL,
  VSM_SOFT_RECEIVER_THRESHOLD,
  computePageCoordinate,
  getLightPosition,
  getPageCoordinate,
  getPageKey,
  getPageSize,
  getPageTag,
  getReceiverLevel,
  getSoftReceiverLevel,
  getWindowCenter,
  getWindowPage,
  isPageInWindow,
} from "./VSMMath";

const TILE_SIZE = 2;
const REQUEST_WORKGROUP_SIZE = 8;
const FILTER_TEXELS = 3;
const REQUEST_WORD_COUNT = VSM_PAGE_COUNT / 32;
const INVALID_MINIMUM = 1e8;
const INVALID_MAXIMUM = -1e8;
const READBACK_INTERVAL_MS = 1000;
const MAX_INVALIDATION_BOXES = 64;
const EMPTY_LIST_OFFSET = VSM_LEVEL_COUNT * VSM_POOL_CAPACITY;
const REUSABLE_LIST_OFFSET = EMPTY_LIST_OFFSET + VSM_POOL_CAPACITY;
const LIST_SIZE = REUSABLE_LIST_OFFSET + VSM_POOL_CAPACITY;

export class VSMPages {
  readonly stats: ShadowPageStats = {
    requested: 0,
    allocated: 0,
    dynamic: 0,
    missing: 0,
  };
  private renderer: WebGPURenderer;
  private context: VSMContext;
  private depthSize = uniform(new Vector2(1, 1));
  private requestBits = new StorageBufferAttribute(
    new Uint32Array(REQUEST_WORD_COUNT),
    1,
  );
  private atomicRequestBits = storage(
    this.requestBits,
    "uint",
    REQUEST_WORD_COUNT,
  ).toAtomic();
  private depthNode: TextureNode;
  private softReceiverNode: TextureNode;
  private lists = new StorageBufferAttribute(new Uint32Array(LIST_SIZE), 1);
  private listsNode = storage(this.lists, "uint", LIST_SIZE);
  private invalidationValues = new Uint32Array(
    MAX_INVALIDATION_BOXES * VSM_LEVEL_COUNT * 4,
  );
  private invalidationRects = new StorageBufferAttribute(
    this.invalidationValues,
    4,
  );
  private invalidationCount = uniform(0, "uint");
  private corner = new Vector3();
  private hasPendingInvalidation = false;
  private hasPendingWork = true;
  private hasDispatchedResidency = false;
  private isReadbackPending = false;
  private nextReadbackTime = 0;
  private requestResetNode;
  private requestNode;
  private requestDispatchSize = [1, 1, 1];
  private resetNode;
  private invalidateNode;
  private collectNode;
  private freeNode;
  private allocateNode;

  constructor(
    renderer: WebGPURenderer,
    context: VSMContext,
    depthTexture: Texture,
    softReceiverTexture: Texture,
  ) {
    this.renderer = renderer;
    this.context = context;
    const { cameraPosition, lightBasis } = context;
    this.depthNode = texture(depthTexture);
    this.softReceiverNode = texture(softReceiverTexture);
    const { atomicRequestBits } = this;
    const atomicCounters = storage(
      context.counters,
      "uint",
      VSM_COUNTER_COUNT,
    ).toAtomic();
    const pageJobsNode = storage(context.pageJobs, "uvec4", VSM_JOB_COUNT);
    const invalidationRects = storage(
      this.invalidationRects,
      "uvec4",
      MAX_INVALIDATION_BOXES * VSM_LEVEL_COUNT,
    );

    this.requestResetNode = Fn(() => {
      atomicStore(atomicRequestBits.element(instanceIndex), 0);
    })().compute(REQUEST_WORD_COUNT, [64]);

    this.requestNode = Fn(() => {
      const tile = uvec2(globalId.xy);
      const levelBounds: Node<"vec4">[] = [];
      for (let levelIndex = 0; levelIndex < VSM_LEVEL_COUNT; levelIndex++)
        levelBounds.push(
          vec4(
            INVALID_MINIMUM,
            INVALID_MINIMUM,
            INVALID_MAXIMUM,
            INVALID_MAXIMUM,
          ).toVar(),
        );
      Loop({ start: 0, end: TILE_SIZE, type: "uint" }, ({ i: localYIndex }) => {
        const localY = localYIndex.toVar();
        Loop(
          { start: 0, end: TILE_SIZE, type: "uint" },
          ({ i: localXIndex }) => {
            const localX = localXIndex.toVar();
            const receiver = this.loadReceiver(tile, localX, localY);
            const level = receiver.level.toVar();
            const upperLevel = receiver.upperLevel.toVar();
            const lightPosition = receiver.lightPosition.toVar();
            const expandedBounds = vec4(lightPosition, lightPosition);
            for (
              let levelIndex = 0;
              levelIndex < VSM_LEVEL_COUNT;
              levelIndex++
            ) {
              const bounds = levelBounds[levelIndex];
              const isHit = receiver.isValid.and(
                level.equal(levelIndex).or(upperLevel.equal(levelIndex)),
              );
              bounds.assign(
                isHit.select(
                  vec4(
                    bounds.xy.min(expandedBounds.xy),
                    bounds.zw.max(expandedBounds.zw),
                  ),
                  bounds,
                ),
              );
            }
          },
        );
      });
      for (let levelIndex = 0; levelIndex < VSM_LEVEL_COUNT; levelIndex++) {
        const bounds = levelBounds[levelIndex];
        If(bounds.x.lessThan(INVALID_MINIMUM), () => {
          this.requestPages(uint(levelIndex), bounds);
        });
      }
    })().computeKernel([REQUEST_WORKGROUP_SIZE, REQUEST_WORKGROUP_SIZE]);

    this.resetNode = Fn(() => {
      Loop(
        { start: 0, end: VSM_COUNTER_COUNT, type: "uint" },
        ({ i: index }) => {
          atomicStore(atomicCounters.element(index), 0);
        },
      );
    })().compute(1, [1]);

    this.invalidateNode = Fn(() => {
      const metadata = context.slotMetadataNode.element(instanceIndex);
      If(
        metadata.x
          .notEqual(VSM_INVALID_PAGE_KEY)
          .and(metadata.w.equal(context.pageGeneration)),
        () => {
          const level = metadata.x.div(VSM_PAGES_PER_LEVEL).toVar();
          const pageCoordinate = getWindowPage(
            metadata.x,
            getWindowCenter(cameraPosition, lightBasis, level),
          ).toVar();
          const isInvalid = getPageTag(pageCoordinate)
            .notEqual(metadata.y)
            .toVar();
          Loop(
            { start: uint(0), end: this.invalidationCount, type: "uint" },
            ({ i: boxIndex }) => {
              const rect = invalidationRects.element(
                boxIndex.mul(VSM_LEVEL_COUNT).add(level),
              );
              isInvalid.assign(
                isInvalid.or(
                  pageCoordinate.x
                    .greaterThanEqual(rect.x)
                    .and(pageCoordinate.y.greaterThanEqual(rect.y))
                    .and(pageCoordinate.x.lessThanEqual(rect.z))
                    .and(pageCoordinate.y.lessThanEqual(rect.w)),
                ),
              );
            },
          );
          If(isInvalid, () => {
            metadata.assign(uvec4(metadata.x, metadata.y, metadata.z, 0));
          });
        },
      );
    })().compute(VSM_POOL_CAPACITY, [64]);

    this.collectNode = Fn(() => {
      const word = atomicLoad(atomicRequestBits.element(instanceIndex));
      If(word.notEqual(0), () => {
        Loop({ start: 0, end: 32, type: "uint" }, ({ i: bitIndex }) => {
          If(word.shiftRight(bitIndex).bitAnd(1).notEqual(0), () => {
            const pageKey = instanceIndex.mul(32).add(bitIndex);
            const level = pageKey.div(VSM_PAGES_PER_LEVEL);
            const pageCoordinate = getWindowPage(
              pageKey,
              getWindowCenter(cameraPosition, lightBasis, level),
            );
            const pageTag = getPageTag(pageCoordinate);
            const { slot, isResident } = context.resolvePage(pageKey, pageTag);
            atomicAdd(atomicCounters.element(VSM_COUNTER_REQUESTED), 1);
            If(isResident, () => {
              context.slotMetadataNode
                .element(slot)
                .assign(
                  uvec4(
                    pageKey,
                    pageTag,
                    context.frame,
                    context.pageGeneration,
                  ),
                );
              const activeIndex = atomicAdd(
                atomicCounters.element(VSM_COUNTER_ACTIVE),
                1,
              );
              pageJobsNode
                .element(activeIndex.add(VSM_JOBS_ACTIVE))
                .assign(uvec4(pageKey, slot, pageCoordinate));
            }).Else(() => {
              const missIndex = atomicAdd(
                atomicCounters.element(level.add(VSM_COUNTER_LEVEL_MISSES)),
                1,
              );
              If(missIndex.lessThan(VSM_POOL_CAPACITY), () => {
                this.listsNode
                  .element(level.mul(VSM_POOL_CAPACITY).add(missIndex))
                  .assign(pageKey);
              });
            });
          });
        });
      });
    })().compute(REQUEST_WORD_COUNT, [64]);

    this.freeNode = Fn(() => {
      const metadata = context.slotMetadataNode.element(instanceIndex);
      If(metadata.z.notEqual(context.frame), () => {
        If(
          metadata.x
            .equal(VSM_INVALID_PAGE_KEY)
            .or(metadata.w.notEqual(context.pageGeneration)),
          () => {
            const index = atomicAdd(
              atomicCounters.element(VSM_COUNTER_EMPTY),
              1,
            );
            this.listsNode
              .element(index.add(EMPTY_LIST_OFFSET))
              .assign(instanceIndex);
          },
        ).Else(() => {
          const index = atomicAdd(
            atomicCounters.element(VSM_COUNTER_REUSABLE),
            1,
          );
          this.listsNode
            .element(index.add(REUSABLE_LIST_OFFSET))
            .assign(instanceIndex);
        });
      });
    })().compute(VSM_POOL_CAPACITY, [64]);

    this.allocateNode = Fn(() => {
      const level = instanceIndex.div(VSM_POOL_CAPACITY);
      const missIndex = instanceIndex.mod(VSM_POOL_CAPACITY);
      const levelMisses = atomicLoad(
        atomicCounters.element(level.add(VSM_COUNTER_LEVEL_MISSES)),
      );
      If(missIndex.lessThan(levelMisses), () => {
        const rank = missIndex.toVar();
        Loop({ start: uint(0), end: level, type: "uint" }, ({ i: finer }) => {
          const finerMisses = atomicLoad(
            atomicCounters.element(finer.add(VSM_COUNTER_LEVEL_MISSES)),
          );
          rank.addAssign(
            finerMisses
              .lessThan(VSM_POOL_CAPACITY)
              .select(finerMisses, uint(VSM_POOL_CAPACITY)),
          );
        });
        const emptyCount = atomicLoad(
          atomicCounters.element(VSM_COUNTER_EMPTY),
        );
        const reusableCount = atomicLoad(
          atomicCounters.element(VSM_COUNTER_REUSABLE),
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
            .element(level.mul(VSM_POOL_CAPACITY).add(missIndex))
            .toVar();
          const pageCoordinate = getWindowPage(
            pageKey,
            getWindowCenter(cameraPosition, lightBasis, level),
          );
          context.slotMetadataNode
            .element(slot)
            .assign(
              uvec4(
                pageKey,
                getPageTag(pageCoordinate),
                context.frame,
                context.pageGeneration,
              ),
            );
          context.pageTableNode
            .element(pageKey)
            .assign(uvec4(slot.add(1), 0, 0, 0));
          context.slotRenderFramesNode.element(slot).assign(context.frame);
          const job = uvec4(pageKey, slot, pageCoordinate);
          const jobIndex = atomicAdd(
            atomicCounters.element(VSM_COUNTER_ALLOCATED),
            1,
          );
          pageJobsNode.element(jobIndex.add(VSM_JOBS_ALLOCATED)).assign(job);
          const activeIndex = atomicAdd(
            atomicCounters.element(VSM_COUNTER_ACTIVE),
            1,
          );
          pageJobsNode.element(activeIndex.add(VSM_JOBS_ACTIVE)).assign(job);
        }).Else(() => {
          atomicAdd(atomicCounters.element(VSM_COUNTER_MISSING), 1);
        });
      });
    })().compute(VSM_LEVEL_COUNT * VSM_POOL_CAPACITY, [64]);

    this.requestResetNode.name = "VSM page request reset";
    this.requestNode.name = "VSM page requests";
    this.requestNode.dispatchSize = this.requestDispatchSize;
    this.resetNode.name = "VSM page reset";
    this.invalidateNode.name = "VSM page invalidate";
    this.collectNode.name = "VSM page collect";
    this.freeNode.name = "VSM page free";
    this.allocateNode.name = "VSM page allocate";
  }

  private loadReceiver(
    tile: Node<"uvec2">,
    localX: Node<"uint">,
    localY: Node<"uint">,
  ) {
    const { context } = this;
    const pixel = tile.mul(TILE_SIZE).add(uvec2(localX, localY));
    const isInside = pixel.x
      .lessThan(uint(this.depthSize.x))
      .and(pixel.y.lessThan(uint(this.depthSize.y)));
    const depth = textureLoad(this.depthNode, pixel).level(uint(0)).r;
    const uv = vec2(pixel).add(0.5).div(this.depthSize);
    const viewPosition = getViewPosition(
      uv,
      depth,
      context.projectionMatrixInverse,
    );
    const worldPosition = context.cameraWorldMatrix.mul(
      vec4(viewPosition, 1),
    ).xyz;
    const softness = textureLoad(this.softReceiverNode, pixel).level(uint(0)).r;
    const viewDistance = viewPosition.length();
    const isSoftReceiver = softness.greaterThan(VSM_SOFT_RECEIVER_THRESHOLD);
    const softLevel = getSoftReceiverLevel(viewDistance, softness).floor();
    const level = isSoftReceiver.select(
      uint(softLevel),
      getReceiverLevel(viewDistance),
    );
    return {
      isValid: isInside.and(depth.lessThan(1)),
      level,
      upperLevel: isSoftReceiver.select(
        uint(softLevel.add(1).min(VSM_LEVEL_COUNT - 1)),
        level,
      ),
      lightPosition: getLightPosition(worldPosition, context.lightBasis),
    };
  }

  private requestPages(level: Node<"uint">, bounds: Node<"vec4">) {
    const { cameraPosition, lightBasis } = this.context;
    const pageSize = getPageSize(level);
    const filterMargin = pageSize.mul(FILTER_TEXELS / VSM_PAGE_TEXELS);
    const firstPage = getPageCoordinate(
      bounds.xy.sub(filterMargin).div(pageSize),
    );
    const lastPage = getPageCoordinate(
      bounds.zw.add(filterMargin).div(pageSize),
    );
    const windowCenter = getWindowCenter(cameraPosition, lightBasis, level);
    const pageWidth = lastPage.x.sub(firstPage.x).add(1);
    const pageHeight = lastPage.y.sub(firstPage.y).add(1);
    Loop(
      { start: 0, end: pageWidth.mul(pageHeight), type: "uint" },
      ({ i: pageLoopIndex }) => {
        const pageIndex = pageLoopIndex.toVar();
        const pageCoordinate = firstPage.add(
          uvec2(pageIndex.mod(pageWidth), pageIndex.div(pageWidth)),
        );
        If(isPageInWindow(pageCoordinate, windowCenter), () => {
          const key = getPageKey(level, pageCoordinate);
          atomicOr(
            this.atomicRequestBits.element(key.div(32)),
            uint(1).shiftLeft(key.mod(32)),
          );
        });
      },
    );
  }

  collectRequestNodes(nodes: ComputeNode[]) {
    const { changes, drawingBufferSize } = this.context;
    if (!changes.shouldRequestPages) return;
    const width = Math.max(1, Math.floor(drawingBufferSize.x));
    const height = Math.max(1, Math.floor(drawingBufferSize.y));
    this.depthSize.value.set(width, height);
    this.requestDispatchSize[0] = Math.ceil(
      width / (REQUEST_WORKGROUP_SIZE * TILE_SIZE),
    );
    this.requestDispatchSize[1] = Math.ceil(
      height / (REQUEST_WORKGROUP_SIZE * TILE_SIZE),
    );
    nodes.push(this.requestResetNode, this.requestNode);
  }

  collectResidencyNodes(nodes: ComputeNode[]) {
    const { changes, staticBoundsToRedraw } = this.context;
    const hasFullInvalidation = this.context.takePageInvalidation();
    if (hasFullInvalidation) this.hasPendingWork = true;
    else if (staticBoundsToRedraw.length > 0)
      this.writeInvalidationRects(staticBoundsToRedraw);
    this.context.clearStaticBoundsToRedraw();

    if (this.hasDispatchedResidency) this.refreshStatsOnInterval();
    if (
      !changes.shouldRequestPages &&
      !this.hasPendingWork &&
      this.stats.missing === 0
    )
      return false;
    this.hasPendingWork = false;
    this.hasDispatchedResidency = true;
    nodes.push(this.resetNode);
    if (this.hasPendingInvalidation) nodes.push(this.invalidateNode);
    this.hasPendingInvalidation = false;
    nodes.push(this.collectNode, this.freeNode, this.allocateNode);
    return true;
  }

  private writeInvalidationRects(boxes: Box3[]) {
    const { x: lightX, y: lightY } = this.context.lightBasis;
    const boxCount = Math.min(boxes.length, MAX_INVALIDATION_BOXES);
    for (let rect = 0; rect < boxCount * VSM_LEVEL_COUNT; rect++)
      this.invalidationValues.set([0xffffffff, 0xffffffff, 0, 0], rect * 4);
    for (let index = 0; index < boxes.length; index++) {
      const { min, max } = boxes[index];
      const offset =
        Math.min(index, MAX_INVALIDATION_BOXES - 1) * VSM_LEVEL_COUNT * 4;
      for (let level = 0; level < VSM_LEVEL_COUNT; level++) {
        const rectOffset = offset + level * 4;
        for (let corner = 0; corner < 8; corner++) {
          this.corner.set(
            corner & 1 ? max.x : min.x,
            corner & 2 ? max.y : min.y,
            corner & 4 ? max.z : min.z,
          );
          const page = computePageCoordinate(
            this.corner,
            lightX.value,
            lightY.value,
            level,
          );
          const values = this.invalidationValues;
          values[rectOffset] = Math.min(values[rectOffset], page.x);
          values[rectOffset + 1] = Math.min(values[rectOffset + 1], page.y);
          values[rectOffset + 2] = Math.max(values[rectOffset + 2], page.x);
          values[rectOffset + 3] = Math.max(values[rectOffset + 3], page.y);
        }
      }
    }
    this.invalidationRects.needsUpdate = true;
    this.invalidationCount.value = boxCount;
    this.hasPendingInvalidation = true;
    this.hasPendingWork = true;
  }

  private refreshStatsOnInterval() {
    const now = performance.now();
    if (this.isReadbackPending || now < this.nextReadbackTime) return;
    this.isReadbackPending = true;
    this.nextReadbackTime = now + READBACK_INTERVAL_MS;
    void this.refreshStatsAsync();
  }

  private async refreshStatsAsync() {
    const { context } = this;
    try {
      const residency = new Uint32Array(
        await this.renderer.getArrayBufferAsync(context.counters),
      );
      const dynamicCounters = new Uint32Array(
        await this.renderer.getArrayBufferAsync(context.dynamicCounters),
      );
      this.stats.requested = residency[VSM_COUNTER_REQUESTED];
      this.stats.allocated = residency[VSM_COUNTER_ALLOCATED];
      this.stats.dynamic = dynamicCounters[VSM_DYNAMIC_COUNTER_TOTAL];
      let overflow = 0;
      for (let level = 0; level < VSM_LEVEL_COUNT; level++)
        overflow += Math.max(
          0,
          residency[VSM_COUNTER_LEVEL_MISSES + level] - VSM_POOL_CAPACITY,
        );
      this.stats.missing = residency[VSM_COUNTER_MISSING] + overflow;
    } catch (error) {
      console.error("Shadow page stats readback failed", error);
    } finally {
      this.isReadbackPending = false;
    }
  }
}
