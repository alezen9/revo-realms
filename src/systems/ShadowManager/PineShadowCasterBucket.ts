import { BufferGeometry } from "three";
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
  uvec4,
} from "three/tsl";
import type { PineShadowPages } from "./PineShadowPages";
import {
  decodeGpuShadowPageKey,
  SHADOW_PAGE_LEVEL_COUNT,
} from "./ShadowPageCoordinates";
import {
  SHADOW_RENDERED_PAGE_COUNTER,
  type ShadowResidency,
} from "./ShadowResidency";

export class PineShadowCasterBucket {
  readonly geometry: BufferGeometry;
  readonly workItemsAttribute: StorageBufferAttribute;
  readonly matrixColumnsAttribute: StorageBufferAttribute;

  private renderer: WebGPURenderer;
  private residency: ShadowResidency;
  private pages: PineShadowPages;
  private instanceCount: number;
  private indirectArguments: IndirectStorageBufferAttribute;
  private resetNode;
  private buildNode;

  constructor(
    renderer: WebGPURenderer,
    residency: ShadowResidency,
    pages: PineShadowPages,
    source: BatchedMesh,
  ) {
    this.renderer = renderer;
    this.residency = residency;
    this.pages = pages;
    this.instanceCount = source.instanceCount;
    this.geometry = source.geometry.index
      ? source.geometry.toNonIndexed()
      : source.geometry.clone();
    const position = this.geometry.getAttribute("position");
    if (!position) throw new Error("Pine shadow caster requires positions");
    this.workItemsAttribute = new StorageBufferAttribute(
      new Uint32Array(this.instanceCount * residency.capacity * 4),
      4,
    );
    this.matrixColumnsAttribute = pages.matrixColumnsAttribute;
    this.indirectArguments = new IndirectStorageBufferAttribute(
      new Uint32Array([position.count, 0, 0, 0]),
      1,
    );
    this.geometry.setIndirect(this.indirectArguments);

    const nodes = this.createComputeNodes();
    this.resetNode = nodes.reset;
    this.buildNode = nodes.build;
  }

  run() {
    this.renderer.compute(this.resetNode);
    this.renderer.compute(this.buildNode);
  }

  private createComputeNodes() {
    const sourcePageJobs = storage(
      this.residency.pageJobsAttribute,
      "uvec2",
      this.residency.pageJobsAttribute.count,
    );
    const residencyCounters = storage(
      this.residency.counterAttribute,
      "uint",
      this.residency.counterAttribute.count,
    );
    const pageRanges = storage(
      this.pages.pageRangesAttribute,
      "uvec4",
      this.pages.pageRangesAttribute.count,
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

    const reset = Fn(() => {
      atomicStore(indirectArguments.element(1), 0);
    })().compute(1);
    reset.name = "Reset pine shadow caster worklist";

    const build = Fn(() => {
      const pineIndex = instanceIndex;
      const renderedPageCount = residencyCounters
        .element(SHADOW_RENDERED_PAGE_COUNTER)
        .toVar();
      If(renderedPageCount.greaterThan(this.residency.capacity), () => {
        renderedPageCount.assign(this.residency.capacity);
      });
      Loop(
        { start: 0, end: renderedPageCount, type: "uint" },
        ({ i: pageIndex }) => {
          const pageJob = sourcePageJobs.element(pageIndex);
          const pageKey = pageJob.x;
          const {
            level,
            localPageX: pageX,
            localPageY: pageY,
          } = decodeGpuShadowPageKey(pageKey);
          const range = pageRanges.element(
            pineIndex.mul(SHADOW_PAGE_LEVEL_COUNT).add(level),
          );
          const overlaps = pageX
            .greaterThanEqual(range.x)
            .and(pageY.greaterThanEqual(range.y))
            .and(pageX.lessThanEqual(range.z))
            .and(pageY.lessThanEqual(range.w));
          If(overlaps, () => {
            const outputIndex = atomicAdd(indirectArguments.element(1), 1);
            If(outputIndex.lessThan(this.workItemsAttribute.count), () => {
              workItems
                .element(outputIndex)
                .assign(uvec4(pageJob.x, pageJob.y, pineIndex, uint(0)));
            });
          });
        },
      );
    })().compute(this.instanceCount, [Math.min(this.instanceCount, 64)]);
    build.name = "Build pine shadow caster worklist";

    return { reset, build };
  }
}
