import { BufferGeometry, type Mesh } from "three";
import {
  IndirectStorageBufferAttribute,
  StorageBufferAttribute,
  type Node,
} from "three/webgpu";
import {
  atomicAdd,
  atomicStore,
  atomicSub,
  bool,
  Fn,
  If,
  instanceIndex,
  Loop,
  storage,
  uvec2,
  uvec4,
  vec3,
} from "three/tsl";
import type { VSMGpuInstances } from "./VSMContext";
import {
  getReceiverLevel,
  getLightPosition,
  getPageCoordinate,
  getPageKey,
  getPageSize,
  getPageTag,
  VSM_PAGES_PER_LEVEL,
} from "./VSMMath";
import type { VSMContext } from "./VSMContext";

const MAX_WORK_ITEMS = 262144;

export class ShadowDeformedCasterBucket {
  readonly geometry: BufferGeometry;
  readonly workItemsAttribute = new StorageBufferAttribute(
    new Uint32Array(MAX_WORK_ITEMS * 4),
    4,
  );
  readonly instances: VSMGpuInstances;
  private resetNode;
  private buildNode;

  constructor(
    context: VSMContext,
    source: Mesh,
    instances: VSMGpuInstances,
    sunDirection: Node<"vec3">,
  ) {
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
    this.geometry.setAttribute("shadowIndirect", indirect);
    this.geometry.setAttribute("shadowWorkItems", this.workItemsAttribute);
    const indirectNode = storage(indirect, "uint", indirect.count).toAtomic();
    const workItems = storage(this.workItemsAttribute, "uvec4", MAX_WORK_ITEMS);

    this.resetNode = Fn(() => {
      atomicStore(indirectNode.element(1), 0);
    })().compute(1, [1]);

    this.buildNode = Fn(() => {
      If(instances.isActive(instanceIndex), () => {
        const base = instances.baseWorldPosition(instanceIndex);
        const height = instances.height(instanceIndex);
        const lightBase = getLightPosition(base, sunDirection);
        const lightTop = getLightPosition(
          base.add(vec3(0, height, 0)),
          sunDirection,
        );
        const minimum = lightBase.min(lightTop).sub(instances.radiusMeters);
        const maximum = lightBase.max(lightTop).add(instances.radiusMeters);
        const distance = base.sub(context.cameraPosition).length();
        const reach = height.add(instances.radiusMeters);
        const firstLevel = getReceiverLevel(
          distance.sub(reach).max(0),
          bool(false),
        );
        const lastLevel = getReceiverLevel(distance.add(reach), bool(true));
        Loop(
          { start: firstLevel, end: lastLevel.add(1), type: "uint" },
          ({ i: levelIndex }) => {
            const level = levelIndex.toVar();
            const pageSize = getPageSize(level);
            const firstPage = getPageCoordinate(minimum.div(pageSize));
            const lastPage = getPageCoordinate(maximum.div(pageSize));
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
                const pageKey = getPageKey(level, pageCoordinate);
                const { slot, isResident } = context.resolvePage(
                  pageKey,
                  getPageTag(pageCoordinate),
                );
                const isActive = context.pageTableNode
                  .element(pageKey)
                  .w.equal(context.frame);
                If(isResident.and(isActive), () => {
                  const itemIndex = atomicAdd(indirectNode.element(1), 1);
                  If(itemIndex.lessThan(MAX_WORK_ITEMS), () => {
                    workItems
                      .element(itemIndex)
                      .assign(uvec4(pageKey, instanceIndex, pageCoordinate));
                    context.pageTableNode
                      .element(pageKey)
                      .assign(
                        uvec4(slot.add(1), context.frame, 0, context.frame),
                      );
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
      pageKey: workItem.x,
      level: workItem.x.div(VSM_PAGES_PER_LEVEL),
      instance: workItem.y,
      pageCoordinate: workItem.zw.toVec2(),
    };
  }

  get computeNodes() {
    return [this.resetNode, this.buildNode];
  }

  dispose() {
    this.geometry.dispose();
    this.resetNode.dispose();
    this.buildNode.dispose();
  }
}
