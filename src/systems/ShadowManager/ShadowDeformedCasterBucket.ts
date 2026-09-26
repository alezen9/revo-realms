import { BufferGeometry, type Mesh } from "three";
import {
  IndirectStorageBufferAttribute,
  StorageBufferAttribute,
  type Node,
  type WebGPURenderer,
} from "three/webgpu";
import {
  atomicAdd,
  atomicStore,
  atomicSub,
  Fn,
  If,
  instanceIndex,
  Loop,
  storage,
  uvec2,
  uvec4,
  vec3,
} from "three/tsl";
import type { ShadowDeformedInstances } from "./ShadowCasterRegistry";
import {
  getShadowDynamicLevel,
  getShadowLevel,
  getShadowLightPosition,
  getShadowPageCoordinate,
  getShadowPageKey,
  getShadowPageSize,
  getShadowPageTag,
} from "./ShadowPageCoordinates";
import type { ShadowResidency } from "./ShadowResidency";

const MAX_WORK_ITEMS = 262144;

export class ShadowDeformedCasterBucket {
  readonly geometry: BufferGeometry;
  readonly workItemsAttribute = new StorageBufferAttribute(
    new Uint32Array(MAX_WORK_ITEMS * 4),
    4,
  );
  readonly instances: ShadowDeformedInstances;
  readonly cornersAttribute?: StorageBufferAttribute;
  private renderer: WebGPURenderer;
  private resetNode;
  private buildNode;

  constructor(
    renderer: WebGPURenderer,
    residency: ShadowResidency,
    source: Mesh,
    instances: ShadowDeformedInstances,
    sunDirection: Node<"vec3">,
  ) {
    this.renderer = renderer;
    this.instances = instances;
    this.geometry = instances.geometry
      ? new BufferGeometry().copy(instances.geometry)
      : source.geometry.clone();
    const position = this.geometry.getAttribute("position");
    if (!position) throw new Error("Deformed shadow caster needs positions");
    const indirect = new IndirectStorageBufferAttribute(
      this.geometry.index
        ? new Uint32Array([this.geometry.index.count, 0, 0, 0, 0])
        : new Uint32Array([position.count, 0, 0, 0]),
      1,
    );
    this.geometry.setIndirect(indirect);
    if (!this.geometry.index) {
      const corners = new Float32Array(position.count * 4);
      for (let index = 0; index < position.count; index++) {
        corners[index * 4] = position.getX(index);
        corners[index * 4 + 1] = position.getY(index);
        corners[index * 4 + 2] = position.getZ(index);
      }
      this.cornersAttribute = new StorageBufferAttribute(corners, 4);
    }
    const indirectNode = storage(indirect, "uint", indirect.count).toAtomic();
    const workItems = storage(this.workItemsAttribute, "uvec4", MAX_WORK_ITEMS);

    this.resetNode = Fn(() => {
      atomicStore(indirectNode.element(1), 0);
    })().compute(1, [1]);

    this.buildNode = Fn(() => {
      If(instances.isActive(instanceIndex), () => {
        const base = instances.baseWorldPosition(instanceIndex);
        const height = instances.height(instanceIndex);
        const lightBase = getShadowLightPosition(base, sunDirection);
        const lightTop = getShadowLightPosition(
          base.add(vec3(0, height, 0)),
          sunDirection,
        );
        const minimum = lightBase.min(lightTop).sub(instances.radiusMeters);
        const maximum = lightBase.max(lightTop).add(instances.radiusMeters);
        const distance = base.sub(residency.cameraPosition).length();
        const reach = height.add(instances.radiusMeters);
        const firstLevel = getShadowDynamicLevel(
          getShadowLevel(distance.sub(reach).max(0)),
        );
        const lastLevel = getShadowDynamicLevel(
          getShadowLevel(distance.add(reach)),
        );
        Loop(
          { start: firstLevel, end: lastLevel.add(1), type: "uint" },
          ({ i: levelIndex }) => {
            const level = levelIndex.toVar();
            const pageSize = getShadowPageSize(level);
            const firstPage = getShadowPageCoordinate(minimum.div(pageSize));
            const lastPage = getShadowPageCoordinate(maximum.div(pageSize));
            const pageWidth = lastPage.x.sub(firstPage.x).add(1);
            const pageCount = pageWidth.mul(lastPage.y.sub(firstPage.y).add(1));
            Loop(
              { start: 0, end: pageCount, type: "uint" },
              ({ i: pageLoopIndex }) => {
                const pageCoordinate = firstPage.add(
                  uvec2(
                    pageLoopIndex.mod(pageWidth),
                    pageLoopIndex.div(pageWidth),
                  ),
                );
                const pageKey = getShadowPageKey(level, pageCoordinate);
                const { slot, isResident } = residency.resolvePage(
                  pageKey,
                  getShadowPageTag(pageCoordinate),
                );
                If(isResident, () => {
                  const itemIndex = atomicAdd(indirectNode.element(1), 1);
                  If(itemIndex.lessThan(MAX_WORK_ITEMS), () => {
                    workItems
                      .element(itemIndex)
                      .assign(
                        uvec4(
                          slot.bitOr(level.shiftLeft(16)),
                          instanceIndex,
                          pageCoordinate,
                        ),
                      );
                    residency.pageTableNode
                      .element(pageKey)
                      .assign(uvec2(slot.add(1), residency.frame));
                  }).Else(() => {
                    atomicSub(indirectNode.element(1), 1);
                  });
                });
              },
            );
          },
        );
      });
    })().compute(instances.count, [64]);
    this.resetNode.name = "V2 deformed page work reset";
    this.buildNode.name = "V2 deformed page work";
  }

  getWorkItem(index: Node<"uint">) {
    const workItem = storage(
      this.workItemsAttribute,
      "uvec4",
      MAX_WORK_ITEMS,
    ).element(index);
    return {
      slot: workItem.x.bitAnd(0xffff),
      level: workItem.x.shiftRight(16),
      instance: workItem.y,
      pageCoordinate: workItem.zw.toVec2(),
    };
  }

  run() {
    this.renderer.compute(this.resetNode);
    this.renderer.compute(this.buildNode);
  }

  dispose() {
    this.geometry.dispose();
  }
}
