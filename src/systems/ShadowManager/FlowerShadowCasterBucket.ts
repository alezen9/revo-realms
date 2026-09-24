import { BufferGeometry, Mesh } from "three";
import {
  IndirectStorageBufferAttribute,
  StorageBufferAttribute,
  type Node,
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
import {
  FLOWER_SHADOW_INSTANCE_COUNT,
  FlowersSsbo,
  getFlowerCenterWorldPosition,
} from "../../entities/Vegetation/Flowers";
import {
  computeGpuShadowPageAddress,
  decodeGpuShadowPageKey,
  encodeGpuShadowPageKey,
  SHADOW_PAGE_LEVEL_COUNT,
} from "./ShadowPageCoordinates";
import {
  SHADOW_RENDERED_PAGE_COUNTER,
  type ShadowResidency,
} from "./ShadowResidency";

export class FlowerShadowCasterBucket {
  readonly geometry: BufferGeometry;
  readonly workItemsAttribute: StorageBufferAttribute;

  private renderer: WebGPURenderer;
  private residency: ShadowResidency;
  private ssbo: FlowersSsbo;
  private minimumWorldY: Node<"float">;
  private maximumWorldY: Node<"float">;
  private sunDirection: Node<"vec3">;
  private indirectArguments: IndirectStorageBufferAttribute;
  private resetNode;
  private buildNode;

  constructor(
    renderer: WebGPURenderer,
    residency: ShadowResidency,
    source: Mesh,
    ssbo: FlowersSsbo,
    minimumWorldY: Node<"float">,
    maximumWorldY: Node<"float">,
    sunDirection: Node<"vec3">,
  ) {
    this.renderer = renderer;
    this.residency = residency;
    this.ssbo = ssbo;
    this.minimumWorldY = minimumWorldY;
    this.maximumWorldY = maximumWorldY;
    this.sunDirection = sunDirection;
    this.geometry = source.geometry.index
      ? source.geometry.toNonIndexed()
      : source.geometry.clone();
    const position = this.geometry.getAttribute("position");
    if (!position) throw new Error("Flower shadow caster requires positions");
    this.workItemsAttribute = new StorageBufferAttribute(
      new Uint32Array(
        FLOWER_SHADOW_INSTANCE_COUNT * SHADOW_PAGE_LEVEL_COUNT * 4,
      ),
      4,
    );
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
    reset.name = "Reset flower shadow caster worklist";

    const build = Fn(() => {
      const flowerIndex = instanceIndex;
      const data = this.ssbo.computeBuffer.element(flowerIndex);
      If(this.ssbo.getGrassScale(data).greaterThan(0.05), () => {
        const worldPosition = getFlowerCenterWorldPosition(
          this.ssbo,
          flowerIndex,
        );
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
            const { level } = decodeGpuShadowPageKey(pageJob.x);
            const address = computeGpuShadowPageAddress({
              worldPosition,
              sunDirection: this.sunDirection,
              minimumWorldY: this.minimumWorldY,
              maximumWorldY: this.maximumWorldY,
              level,
            });
            const flowerPageKey = encodeGpuShadowPageKey(
              level,
              address.pageId,
            );
            If(flowerPageKey.equal(pageJob.x), () => {
              const outputIndex = atomicAdd(indirectArguments.element(1), 1);
              If(outputIndex.lessThan(this.workItemsAttribute.count), () => {
                workItems
                  .element(outputIndex)
                  .assign(uvec4(pageJob.x, pageJob.y, flowerIndex, uint(0)));
              });
            });
          },
        );
      });
    })().compute(FLOWER_SHADOW_INSTANCE_COUNT, [64]);
    build.name = "Build flower shadow caster worklist";

    return { reset, build };
  }
}
