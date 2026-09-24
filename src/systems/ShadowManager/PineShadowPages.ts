import { Box3, Matrix4, Vector3 } from "three";
import {
  BatchedMesh,
  StorageBufferAttribute,
  type WebGPURenderer,
} from "three/webgpu";
import {
  atomicAdd,
  atomicStore,
  Fn,
  If,
  instanceIndex,
  storage,
} from "three/tsl";
import { PINE_CANOPY_MAXIMUM_SWAY } from "../../entities/Vegetation/PineTreeCanopy";
import {
  SHADOW_PAGE_LEVEL_COUNT,
  type ShadowPageCoordinates,
} from "./ShadowPageCoordinates";
import {
  SHADOW_MINIMUM_PAGE_COORDINATE,
  SHADOW_PAGE_GRID_SIZE,
  SHADOW_REQUESTED_PAGE_COUNTER,
} from "./ShadowPageRequests";

export const PINE_SHADOW_PAGE_CAPACITY = 64;

export class PineShadowPages {
  readonly requestListAttribute = new StorageBufferAttribute(
    new Uint32Array(PINE_SHADOW_PAGE_CAPACITY),
    1,
  );
  readonly counterAttribute = new StorageBufferAttribute(new Uint32Array(1), 1);
  readonly matrixColumnsAttribute: StorageBufferAttribute;
  readonly pageRangesAttribute: StorageBufferAttribute;

  private renderer: WebGPURenderer;
  private instanceCount: number;
  private matrixValues: Float32Array;
  private rangeValues: Uint32Array;
  private resetNode;
  private filterNode;
  private localBounds = new Box3();
  private worldBounds = new Box3();
  private instanceMatrix = new Matrix4();
  private worldMatrix = new Matrix4();
  private corner = new Vector3();

  constructor(
    renderer: WebGPURenderer,
    receiverRequests: StorageBufferAttribute,
    receiverCounters: StorageBufferAttribute,
    instanceCount: number,
  ) {
    this.renderer = renderer;
    this.instanceCount = instanceCount;
    this.matrixValues = new Float32Array(instanceCount * 16);
    this.rangeValues = new Uint32Array(
      instanceCount * SHADOW_PAGE_LEVEL_COUNT * 4,
    );
    this.matrixColumnsAttribute = new StorageBufferAttribute(
      this.matrixValues,
      4,
    );
    this.pageRangesAttribute = new StorageBufferAttribute(this.rangeValues, 4);

    const nodes = this.createComputeNodes(receiverRequests, receiverCounters);
    this.resetNode = nodes.reset;
    this.filterNode = nodes.filter;
  }

  update(
    source: BatchedMesh,
    coordinates: ShadowPageCoordinates,
    sunDirection: Vector3,
  ) {
    if (source.instanceCount !== this.instanceCount)
      throw new Error("Pine shadow instance count cannot change");

    source.updateWorldMatrix(true, false);
    source.geometry.computeBoundingBox();
    const sourceBounds = source.geometry.boundingBox;
    if (!sourceBounds) throw new Error("Pine canopy requires bounds");
    this.localBounds.copy(sourceBounds);
    this.localBounds.min.y -= PINE_CANOPY_MAXIMUM_SWAY;
    this.localBounds.max.y += PINE_CANOPY_MAXIMUM_SWAY;

    for (
      let instanceIndex = 0;
      instanceIndex < this.instanceCount;
      instanceIndex++
    ) {
      source.getMatrixAt(instanceIndex, this.instanceMatrix);
      this.worldMatrix.multiplyMatrices(
        source.matrixWorld,
        this.instanceMatrix,
      );
      this.matrixValues.set(this.worldMatrix.elements, instanceIndex * 16);
      this.worldBounds.copy(this.localBounds).applyMatrix4(this.worldMatrix);
      for (let level = 0; level < SHADOW_PAGE_LEVEL_COUNT; level++)
        this.writePageRange(
          instanceIndex,
          level,
          coordinates,
          sunDirection,
          this.rangeValues,
        );
    }
    this.matrixColumnsAttribute.needsUpdate = true;
    this.pageRangesAttribute.needsUpdate = true;
  }

  run() {
    this.renderer.compute(this.resetNode);
    this.renderer.compute(this.filterNode);
  }

  private writePageRange(
    instanceIndex: number,
    level: number,
    coordinates: ShadowPageCoordinates,
    sunDirection: Vector3,
    values: Uint32Array,
  ) {
    let minimumPageX = Number.POSITIVE_INFINITY;
    let minimumPageY = Number.POSITIVE_INFINITY;
    let maximumPageX = Number.NEGATIVE_INFINITY;
    let maximumPageY = Number.NEGATIVE_INFINITY;

    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          this.corner.set(
            x === 0 ? this.worldBounds.min.x : this.worldBounds.max.x,
            y === 0 ? this.worldBounds.min.y : this.worldBounds.max.y,
            z === 0 ? this.worldBounds.min.z : this.worldBounds.max.z,
          );
          const address = coordinates.computeAddress(
            this.corner,
            sunDirection,
            level,
          );
          minimumPageX = Math.min(minimumPageX, address.pageX);
          minimumPageY = Math.min(minimumPageY, address.pageY);
          maximumPageX = Math.max(maximumPageX, address.pageX);
          maximumPageY = Math.max(maximumPageY, address.pageY);
        }
      }
    }

    const maximumGridPage =
      SHADOW_MINIMUM_PAGE_COORDINATE + SHADOW_PAGE_GRID_SIZE - 1;
    const offset = (instanceIndex * SHADOW_PAGE_LEVEL_COUNT + level) * 4;
    if (
      maximumPageX < SHADOW_MINIMUM_PAGE_COORDINATE ||
      maximumPageY < SHADOW_MINIMUM_PAGE_COORDINATE ||
      minimumPageX > maximumGridPage ||
      minimumPageY > maximumGridPage
    ) {
      values.set([1, 1, 0, 0], offset);
      return;
    }

    values[offset] =
      Math.max(minimumPageX, SHADOW_MINIMUM_PAGE_COORDINATE) -
      SHADOW_MINIMUM_PAGE_COORDINATE;
    values[offset + 1] =
      Math.max(minimumPageY, SHADOW_MINIMUM_PAGE_COORDINATE) -
      SHADOW_MINIMUM_PAGE_COORDINATE;
    values[offset + 2] =
      Math.min(maximumPageX, maximumGridPage) - SHADOW_MINIMUM_PAGE_COORDINATE;
    values[offset + 3] =
      Math.min(maximumPageY, maximumGridPage) - SHADOW_MINIMUM_PAGE_COORDINATE;
  }

  private createComputeNodes(
    receiverRequests: StorageBufferAttribute,
    receiverCounters: StorageBufferAttribute,
  ) {
    const receiverRequestList = storage(
      receiverRequests,
      "uint",
      receiverRequests.count,
    );
    const receiverCounterList = storage(
      receiverCounters,
      "uint",
      receiverCounters.count,
    );
    const requestList = storage(
      this.requestListAttribute,
      "uint",
      this.requestListAttribute.count,
    );
    const counters = storage(
      this.counterAttribute,
      "uint",
      this.counterAttribute.count,
    ).toAtomic();

    const reset = Fn(() => {
      atomicStore(counters.element(0), 0);
    })().compute(1);
    reset.name = "Reset pine shadow page requests";

    const filter = Fn(() => {
      const requestIndex = instanceIndex;
      const requestedCount = receiverCounterList
        .element(SHADOW_REQUESTED_PAGE_COUNTER)
        .toVar();
      If(requestedCount.greaterThan(receiverRequests.count), () => {
        requestedCount.assign(receiverRequests.count);
      });
      If(requestIndex.lessThan(requestedCount), () => {
        const pageKey = receiverRequestList.element(requestIndex);
        const outputIndex = atomicAdd(counters.element(0), 1);
        If(outputIndex.lessThan(PINE_SHADOW_PAGE_CAPACITY), () => {
          requestList.element(outputIndex).assign(pageKey);
        });
      });
    })().compute(receiverRequests.count, [64]);
    filter.name = "Gather vegetation shadow page requests";

    return { reset, filter };
  }
}
