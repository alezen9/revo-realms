import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  Vector3,
} from "three";
import {
  IndirectStorageBufferAttribute,
  StorageBufferAttribute,
  type WebGPURenderer,
} from "three/webgpu";
import {
  atomicStore,
  Fn,
  If,
  instanceIndex,
  Loop,
  storage,
  uint,
} from "three/tsl";
import type { ShadowPageCoordinates } from "./ShadowPageCoordinates";
import {
  SHADOW_MINIMUM_PAGE_COORDINATE,
  SHADOW_PAGE_GRID_SIZE,
} from "./ShadowPageRequests";
import {
  SHADOW_RENDERED_PAGE_COUNTER,
  type ShadowResidency,
} from "./ShadowResidency";
import { updateStaticShadowCasterTelemetry } from "./telemetry";

const INDIRECT_ARGUMENT_COUNT = 4;
const INDIRECT_INSTANCE_COUNT_OFFSET = 1;
const INDIRECT_BYTE_STRIDE =
  INDIRECT_ARGUMENT_COUNT * Uint32Array.BYTES_PER_ELEMENT;
const READBACK_INTERVAL_MS = 1_000;

type CasterVertexRange = {
  count: number;
  firstVertex: number;
};

const createBucketGeometry = (sources: Mesh[]) => {
  const ranges: CasterVertexRange[] = [];
  const chunks: Float32Array[] = [];
  let vertexCount = 0;

  for (const source of sources) {
    const geometry = source.geometry.index
      ? source.geometry.toNonIndexed()
      : source.geometry.clone();
    const position = geometry.getAttribute("position");
    if (!position) throw new Error("Shadow caster requires positions");

    const positions = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index++) {
      const offset = index * 3;
      positions[offset] = position.getX(index);
      positions[offset + 1] = position.getY(index);
      positions[offset + 2] = position.getZ(index);
    }
    ranges.push({ count: position.count, firstVertex: vertexCount });
    chunks.push(positions);
    vertexCount += position.count;
    geometry.dispose();
  }

  const positions = new Float32Array(vertexCount * 3);
  let valueOffset = 0;
  for (const chunk of chunks) {
    positions.set(chunk, valueOffset);
    valueOffset += chunk.length;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return { geometry, ranges };
};

export class RigidShadowCasterBucket {
  readonly geometry: BufferGeometry;
  readonly pageJobsAttribute: StorageBufferAttribute;
  readonly matrixColumnsAttribute: StorageBufferAttribute;

  private renderer: WebGPURenderer;
  private residency: ShadowResidency;
  private casterCount: number;
  private indirectArguments: IndirectStorageBufferAttribute;
  private pageRanges: StorageBufferAttribute;
  private matrixValues: Float32Array;
  private rangeValues: Uint32Array;
  private buildWorklistsNode;
  private bounds = new Box3();
  private corner = new Vector3();
  private isReadbackPending = false;
  private nextReadbackTime = 0;

  constructor(
    renderer: WebGPURenderer,
    residency: ShadowResidency,
    sources: Mesh[],
  ) {
    this.renderer = renderer;
    this.residency = residency;
    this.casterCount = sources.length;

    const bucket = createBucketGeometry(sources);
    this.geometry = bucket.geometry;
    this.pageJobsAttribute = new StorageBufferAttribute(
      new Uint32Array(this.casterCount * residency.capacity * 2),
      2,
    );
    this.matrixValues = new Float32Array(this.casterCount * 16);
    this.matrixColumnsAttribute = new StorageBufferAttribute(
      this.matrixValues,
      4,
    );
    this.rangeValues = new Uint32Array(this.casterCount * 4);
    this.pageRanges = new StorageBufferAttribute(this.rangeValues, 4);

    const indirectValues = new Uint32Array(
      this.casterCount * INDIRECT_ARGUMENT_COUNT,
    );
    const indirectOffsets: number[] = [];
    for (let casterIndex = 0; casterIndex < this.casterCount; casterIndex++) {
      const range = bucket.ranges[casterIndex];
      const argumentOffset = casterIndex * INDIRECT_ARGUMENT_COUNT;
      indirectValues[argumentOffset] = range.count;
      indirectValues[argumentOffset + 2] = range.firstVertex;
      indirectValues[argumentOffset + 3] = casterIndex * residency.capacity;
      indirectOffsets.push(casterIndex * INDIRECT_BYTE_STRIDE);
    }
    this.indirectArguments = new IndirectStorageBufferAttribute(
      indirectValues,
      1,
    );
    this.geometry.setIndirect(this.indirectArguments, indirectOffsets);
    this.buildWorklistsNode = this.createBuildWorklistsNode();
  }

  update(
    sources: Mesh[],
    coordinates: ShadowPageCoordinates,
    sunDirection: Vector3,
  ) {
    if (sources.length !== this.casterCount)
      throw new Error("Rigid shadow caster count cannot change");

    for (let casterIndex = 0; casterIndex < sources.length; casterIndex++) {
      const source = sources[casterIndex];
      source.updateWorldMatrix(true, false);
      this.matrixValues.set(source.matrixWorld.elements, casterIndex * 16);
      this.writePageRange(
        casterIndex,
        source,
        coordinates,
        sunDirection,
        this.rangeValues,
      );
    }
    this.matrixColumnsAttribute.needsUpdate = true;
    this.pageRanges.needsUpdate = true;
  }

  run() {
    this.renderer.compute(this.buildWorklistsNode);

    const now = performance.now();
    if (this.isReadbackPending || now < this.nextReadbackTime) return;
    this.nextReadbackTime = now + READBACK_INTERVAL_MS;
    this.isReadbackPending = true;
    void this.refreshTelemetryAsync();
  }

  private writePageRange(
    casterIndex: number,
    source: Mesh,
    coordinates: ShadowPageCoordinates,
    sunDirection: Vector3,
    values: Uint32Array,
  ) {
    this.bounds.setFromObject(source, true);
    let minimumPageX = Number.POSITIVE_INFINITY;
    let minimumPageY = Number.POSITIVE_INFINITY;
    let maximumPageX = Number.NEGATIVE_INFINITY;
    let maximumPageY = Number.NEGATIVE_INFINITY;

    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          this.corner.set(
            x === 0 ? this.bounds.min.x : this.bounds.max.x,
            y === 0 ? this.bounds.min.y : this.bounds.max.y,
            z === 0 ? this.bounds.min.z : this.bounds.max.z,
          );
          const address = coordinates.computeAddress(this.corner, sunDirection);
          minimumPageX = Math.min(minimumPageX, address.pageX);
          minimumPageY = Math.min(minimumPageY, address.pageY);
          maximumPageX = Math.max(maximumPageX, address.pageX);
          maximumPageY = Math.max(maximumPageY, address.pageY);
        }
      }
    }

    const maximumGridPage =
      SHADOW_MINIMUM_PAGE_COORDINATE + SHADOW_PAGE_GRID_SIZE - 1;
    const offset = casterIndex * 4;
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

  private createBuildWorklistsNode() {
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
    const pageRanges = storage(this.pageRanges, "uvec4", this.pageRanges.count);
    const pageJobs = storage(
      this.pageJobsAttribute,
      "uvec2",
      this.pageJobsAttribute.count,
    );
    const indirectArguments = storage(
      this.indirectArguments,
      "uint",
      this.indirectArguments.count,
    ).toAtomic();

    const buildWorklists = Fn(() => {
      const casterIndex = instanceIndex;
      const pageRange = pageRanges.element(casterIndex);
      const worklistOffset = casterIndex.mul(this.residency.capacity);
      const workCount = uint(0).toVar();
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
          const pageX = pageKey.mod(SHADOW_PAGE_GRID_SIZE);
          const pageY = pageKey.div(SHADOW_PAGE_GRID_SIZE);
          const overlaps = pageX
            .greaterThanEqual(pageRange.x)
            .and(pageY.greaterThanEqual(pageRange.y))
            .and(pageX.lessThanEqual(pageRange.z))
            .and(pageY.lessThanEqual(pageRange.w));
          If(overlaps, () => {
            pageJobs.element(worklistOffset.add(workCount)).assign(pageJob);
            workCount.addAssign(1);
          });
        },
      );

      const argumentOffset = casterIndex.mul(INDIRECT_ARGUMENT_COUNT);
      atomicStore(
        indirectArguments.element(
          argumentOffset.add(INDIRECT_INSTANCE_COUNT_OFFSET),
        ),
        workCount,
      );
    })().compute(this.casterCount, [this.casterCount]);
    buildWorklists.name = "Rigid shadow caster page worklists";
    return buildWorklists;
  }

  private async refreshTelemetryAsync() {
    try {
      const buffer = await this.renderer.getArrayBufferAsync(
        this.indirectArguments,
      );
      const argumentsValues = new Uint32Array(buffer);
      let pageJobs = 0;
      let drawCount = 0;
      for (let casterIndex = 0; casterIndex < this.casterCount; casterIndex++) {
        const instanceCount =
          argumentsValues[
            casterIndex * INDIRECT_ARGUMENT_COUNT +
              INDIRECT_INSTANCE_COUNT_OFFSET
          ];
        pageJobs += instanceCount;
        if (instanceCount > 0) drawCount++;
      }
      updateStaticShadowCasterTelemetry(pageJobs, drawCount);
    } catch (error) {
      console.error("[Rigid shadow casters] telemetry readback failed:", error);
    } finally {
      this.isReadbackPending = false;
    }
  }
}
