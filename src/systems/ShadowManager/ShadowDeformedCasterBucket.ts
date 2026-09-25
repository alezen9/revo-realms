import { Mesh } from "three";
import {
  IndirectStorageBufferAttribute,
  StorageBufferAttribute,
  type Node,
  type WebGPURenderer,
} from "three/webgpu";
import {
  atomicAdd,
  atomicStore,
  float,
  Fn,
  If,
  instanceIndex,
  Loop,
  storage,
  uint,
  uniform,
  uvec4,
  vec2,
} from "three/tsl";
import type { ShadowDeformedInstances } from "./ShadowCasterRegistry";
import {
  getGpuShadowPageAddress,
  SHADOW_PAGE_GRID_MIN,
  SHADOW_PAGE_GRID_SIZE,
  SHADOW_PAGES_PER_LEVEL,
  SHADOW_PAGE_WORLD_SIZE,
} from "./ShadowPageCoordinates";
import type { ShadowResidency } from "./ShadowResidency";

export class ShadowDeformedCasterBucket {
  readonly geometry;
  readonly workItemsAttribute: StorageBufferAttribute;
  readonly depthBiasMeters;
  readonly instances: ShadowDeformedInstances;

  private renderer: WebGPURenderer;
  private indirectArguments: IndirectStorageBufferAttribute;
  private resetNode;
  private buildNode;

  constructor(
    renderer: WebGPURenderer,
    residency: ShadowResidency,
    source: Mesh,
    instances: ShadowDeformedInstances,
    sunDirection: Node<"vec3">,
    depthBiasMeters: number,
  ) {
    this.renderer = renderer;
    this.instances = instances;
    this.geometry = source.geometry.clone();
    const position = this.geometry.getAttribute("position");
    if (!position) throw new Error("Deformed shadow caster needs positions");
    this.workItemsAttribute = new StorageBufferAttribute(
      new Uint32Array(instances.count * 2 * 4 * 4),
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
    this.resetNode = Fn(() => {
      atomicStore(indirectArguments.element(1), 0);
    })().compute(1);
    this.resetNode.name = "V2 reset deformed shadow work";

    this.buildNode = Fn(() => {
      const index = instanceIndex;
      If(instances.isActive(index), () => {
        const worldPosition = instances.centerWorldPosition(index);
        Loop({ start: 0, end: 2, type: "uint" }, ({ i: level }) => {
          const address = getGpuShadowPageAddress(
            worldPosition,
            sunDirection,
            level,
          );
          const pageSize = level
            .equal(0)
            .select(
              float(SHADOW_PAGE_WORLD_SIZE),
              float(SHADOW_PAGE_WORLD_SIZE * 2),
            );
          const radius = float(instances.maxRadiusMeters).div(pageSize);
          const pagePosition = address.pageId.add(address.pageUv);
          const firstPage = pagePosition.sub(radius).floor();
          const lastPage = pagePosition.add(radius).floor();
          Loop({ start: 0, end: 2, type: "uint" }, ({ i: offsetY }) => {
            Loop({ start: 0, end: 2, type: "uint" }, ({ i: offsetX }) => {
              const pageId = firstPage.add(
                vec2(float(offsetX), float(offsetY)),
              );
              const isInside = pageId.x
                .lessThanEqual(lastPage.x)
                .and(pageId.y.lessThanEqual(lastPage.y))
                .and(pageId.x.greaterThanEqual(SHADOW_PAGE_GRID_MIN))
                .and(pageId.y.greaterThanEqual(SHADOW_PAGE_GRID_MIN))
                .and(
                  pageId.x.lessThan(
                    SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE,
                  ),
                )
                .and(
                  pageId.y.lessThan(
                    SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE,
                  ),
                );
              If(isInside, () => {
                const pageKey = level.mul(SHADOW_PAGES_PER_LEVEL).add(
                  uint(pageId.y.sub(SHADOW_PAGE_GRID_MIN))
                    .mul(SHADOW_PAGE_GRID_SIZE)
                    .add(uint(pageId.x.sub(SHADOW_PAGE_GRID_MIN))),
                );
                const { slot, isActive } = residency.resolvePage(pageKey);
                If(isActive, () => {
                  const outputIndex = atomicAdd(
                    indirectArguments.element(1),
                    1,
                  );
                  workItems
                    .element(outputIndex)
                    .assign(uvec4(pageKey, slot, index, uint(0)));
                });
              });
            });
          });
        });
      });
    })().compute(instances.count, [64]);
    this.buildNode.name = "V2 deformed shadow page work";
  }

  run() {
    this.renderer.compute(this.resetNode);
    this.renderer.compute(this.buildNode);
  }

  dispose() {
    this.geometry.dispose();
  }
}
