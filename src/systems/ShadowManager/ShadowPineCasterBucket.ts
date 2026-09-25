import { Box3, Matrix4, Vector3 } from "three";
import {
  BatchedMesh,
  IndirectStorageBufferAttribute,
  StorageBufferAttribute,
  type WebGPURenderer,
} from "three/webgpu";
import {
  atomicAdd,
  atomicStore,
  Fn,
  If,
  instanceIndex,
  Loop,
  storage,
  uint,
  uniform,
  uvec2,
  uvec4,
  workgroupBarrier,
} from "three/tsl";
import {
  decodeGpuShadowPageKey,
  SHADOW_PAGE_GRID_MIN,
  SHADOW_PAGE_GRID_SIZE,
  SHADOW_PAGE_LEVEL_COUNT,
  ShadowPageCoordinates,
} from "./ShadowPageCoordinates";
import type { ShadowResidency } from "./ShadowResidency";

export class ShadowPineCasterBucket {
  readonly geometry;
  readonly workItemsAttribute: StorageBufferAttribute;
  readonly matrixColumnsAttribute: StorageBufferAttribute;
  readonly depthBiasMeters;
  readonly bounds = new Box3();

  private renderer: WebGPURenderer;
  private instanceCount: number;
  private matrixValues: Float32Array;
  private rangeValues: Uint32Array;
  private pageRangesAttribute: StorageBufferAttribute;
  private indirectArguments: IndirectStorageBufferAttribute;
  private buildNode;
  private localBounds = new Box3();
  private worldBounds = new Box3();
  private instanceMatrix = new Matrix4();
  private worldMatrix = new Matrix4();
  private corner = new Vector3();
  private coordinates = new ShadowPageCoordinates();

  constructor(
    renderer: WebGPURenderer,
    residency: ShadowResidency,
    source: BatchedMesh,
    kind: "fixed" | "moving",
    depthBiasMeters: number,
  ) {
    this.renderer = renderer;
    this.instanceCount = source.instanceCount;
    this.geometry = source.geometry.clone();
    const position = this.geometry.getAttribute("position");
    if (!position) throw new Error("Pine shadow caster needs positions");
    this.matrixValues = new Float32Array(this.instanceCount * 16);
    this.matrixColumnsAttribute = new StorageBufferAttribute(
      this.matrixValues,
      4,
    );
    this.rangeValues = new Uint32Array(
      this.instanceCount * SHADOW_PAGE_LEVEL_COUNT * 4,
    );
    this.pageRangesAttribute = new StorageBufferAttribute(this.rangeValues, 4);
    this.workItemsAttribute = new StorageBufferAttribute(
      new Uint32Array(this.instanceCount * residency.capacity * 4),
      4,
    );
    this.indirectArguments = new IndirectStorageBufferAttribute(
      this.geometry.index
        ? new Uint32Array([this.geometry.index.count, 0, 0, 0, 0])
        : new Uint32Array([position.count, 0, 0, 0]),
      1,
    );
    this.geometry.setIndirect(this.indirectArguments);
    this.depthBiasMeters = uniform(depthBiasMeters);

    const sourcePageJobs = storage(
      residency.pageJobsAttribute,
      "uvec2",
      residency.capacity * 2,
    );
    const sourceIndirect = storage(
      residency.clearIndirectAttribute,
      "uint",
      16,
    );
    const pageRanges = storage(
      this.pageRangesAttribute,
      "uvec4",
      this.pageRangesAttribute.count,
    );
    const workItems = storage(
      this.workItemsAttribute,
      "uvec4",
      this.workItemsAttribute.count,
    );
    const indirectArguments = storage(
      this.indirectArguments,
      "uint",
      this.indirectArguments.count,
    ).toAtomic();
    const pageCountIndex = kind === "fixed" ? 1 : 9;
    const pageJobOffset = kind === "fixed" ? 0 : residency.capacity;

    this.buildNode = Fn(() => {
      If(instanceIndex.equal(0), () => {
        atomicStore(indirectArguments.element(1), 0);
      });
      workgroupBarrier();
      const pageCount = uint(sourceIndirect.element(pageCountIndex)).toVar();
      If(pageCount.greaterThan(residency.capacity), () => {
        pageCount.assign(residency.capacity);
      });
      Loop(
        {
          start: 0,
          end: Math.ceil(this.instanceCount / 64),
          type: "uint",
        },
        ({ i: chunk }) => {
          const pineIndex = chunk.mul(64).add(instanceIndex);
          If(pineIndex.lessThan(this.instanceCount), () => {
            Loop(
              { start: 0, end: pageCount, type: "uint" },
              ({ i: pageIndex }) => {
                const pageJob = sourcePageJobs.element(
                  pageIndex.add(pageJobOffset),
                );
                const { level, pageId } = decodeGpuShadowPageKey(pageJob.x);
                const page = uvec2(pageId.add(-SHADOW_PAGE_GRID_MIN));
                const range = pageRanges.element(
                  pineIndex.mul(SHADOW_PAGE_LEVEL_COUNT).add(level),
                );
                const overlaps = page.x
                  .greaterThanEqual(range.x)
                  .and(page.y.greaterThanEqual(range.y))
                  .and(page.x.lessThanEqual(range.z))
                  .and(page.y.lessThanEqual(range.w));
                If(overlaps, () => {
                  const index = atomicAdd(indirectArguments.element(1), 1);
                  workItems
                    .element(index)
                    .assign(uvec4(pageJob.x, pageJob.y, pineIndex, uint(0)));
                });
              },
            );
          });
        },
      );
    })().compute(64, [64]);
    this.buildNode.name = `V2 ${kind} pine page work`;
  }

  update(source: BatchedMesh, sunDirection: Vector3, swayMeters: number) {
    if (source.instanceCount !== this.instanceCount)
      throw new Error("Pine shadow instance count changed");
    source.updateWorldMatrix(true, false);
    source.geometry.computeBoundingBox();
    const sourceBounds = source.geometry.boundingBox;
    if (!sourceBounds) throw new Error("Pine shadow caster needs bounds");
    this.localBounds.copy(sourceBounds);
    this.localBounds.min.y -= swayMeters;
    this.localBounds.max.y += swayMeters;
    this.bounds.makeEmpty();

    const maximumPage = SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE - 1;
    for (let index = 0; index < this.instanceCount; index++) {
      source.getMatrixAt(index, this.instanceMatrix);
      this.worldMatrix.multiplyMatrices(
        source.matrixWorld,
        this.instanceMatrix,
      );
      this.matrixValues.set(this.worldMatrix.elements, index * 16);
      this.worldBounds.copy(this.localBounds).applyMatrix4(this.worldMatrix);
      this.bounds.union(this.worldBounds);
      for (let level = 0; level < SHADOW_PAGE_LEVEL_COUNT; level++) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let x = 0; x < 2; x++) {
          for (let y = 0; y < 2; y++) {
            for (let z = 0; z < 2; z++) {
              this.corner.set(
                x === 0 ? this.worldBounds.min.x : this.worldBounds.max.x,
                y === 0 ? this.worldBounds.min.y : this.worldBounds.max.y,
                z === 0 ? this.worldBounds.min.z : this.worldBounds.max.z,
              );
              const page = this.coordinates.getPageCenter(
                this.corner,
                sunDirection,
                level,
              );
              minX = Math.min(minX, page.x);
              minY = Math.min(minY, page.y);
              maxX = Math.max(maxX, page.x);
              maxY = Math.max(maxY, page.y);
            }
          }
        }
        const offset = (index * SHADOW_PAGE_LEVEL_COUNT + level) * 4;
        if (
          maxX < SHADOW_PAGE_GRID_MIN ||
          maxY < SHADOW_PAGE_GRID_MIN ||
          minX > maximumPage ||
          minY > maximumPage ||
          !source.getVisibleAt(index)
        ) {
          this.rangeValues.set([1, 1, 0, 0], offset);
          continue;
        }
        this.rangeValues[offset] =
          Math.max(minX, SHADOW_PAGE_GRID_MIN) - SHADOW_PAGE_GRID_MIN;
        this.rangeValues[offset + 1] =
          Math.max(minY, SHADOW_PAGE_GRID_MIN) - SHADOW_PAGE_GRID_MIN;
        this.rangeValues[offset + 2] =
          Math.min(maxX, maximumPage) - SHADOW_PAGE_GRID_MIN;
        this.rangeValues[offset + 3] =
          Math.min(maxY, maximumPage) - SHADOW_PAGE_GRID_MIN;
      }
    }
    this.matrixColumnsAttribute.needsUpdate = true;
    this.pageRangesAttribute.needsUpdate = true;
  }

  run() {
    this.renderer.compute(this.buildNode);
  }

  dispose() {
    this.geometry.dispose();
  }
}
