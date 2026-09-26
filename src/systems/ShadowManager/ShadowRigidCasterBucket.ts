import { Box3, BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import {
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
  storage,
} from "three/tsl";
import type { ShadowCasterEntry } from "./ShadowCasterRegistry";
import {
  SHADOW_LEVEL_COUNT,
  SHADOW_PAGES_PER_LEVEL,
  ShadowPageCoordinates,
} from "./ShadowPageCoordinates";
import type { ShadowResidency } from "./ShadowResidency";

export class ShadowRigidCasterBucket {
  readonly geometries: BufferGeometry[] = [];
  readonly matrixColumnsAttribute: StorageBufferAttribute;
  readonly pageRangesAttribute: StorageBufferAttribute;
  readonly depthBiasAttribute: StorageBufferAttribute;
  readonly casterJobsAttribute: StorageBufferAttribute;

  readonly casterCount: number;
  private renderer: WebGPURenderer;
  private matrixValues: Float32Array;
  private rangeValues: Uint32Array;
  private depthBiasValues: Float32Array;
  private resetNode;
  private buildNode;
  private bounds = new Box3();
  private corner = new Vector3();
  private coordinates = new ShadowPageCoordinates();

  constructor(
    renderer: WebGPURenderer,
    residency: ShadowResidency,
    sources: ShadowCasterEntry[],
    kind: "fixed" | "moving",
  ) {
    this.renderer = renderer;
    this.casterCount = sources.length;
    const capacity = residency.capacity;
    const indirectValues = new Uint32Array(this.casterCount * 4);
    const indirect = new IndirectStorageBufferAttribute(indirectValues, 1);
    for (let casterIndex = 0; casterIndex < sources.length; casterIndex++) {
      const source = sources[casterIndex].mesh;
      const sourceGeometry = source.geometry.index
        ? source.geometry.toNonIndexed()
        : source.geometry;
      const position = sourceGeometry.getAttribute("position");
      if (!position)
        throw new Error(`Shadow caster needs positions: ${source.name}`);
      const positions = new Float32Array(position.count * 3);
      for (let index = 0; index < position.count; index++) {
        const offset = index * 3;
        positions[offset] = position.getX(index);
        positions[offset + 1] = position.getY(index);
        positions[offset + 2] = position.getZ(index);
      }
      if (sourceGeometry !== source.geometry) sourceGeometry.dispose();
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute(
        "casterIndex",
        new Float32BufferAttribute(
          new Float32Array(position.count).fill(casterIndex),
          1,
        ),
      );
      geometry.setIndirect(indirect, [
        casterIndex * 4 * Uint32Array.BYTES_PER_ELEMENT,
      ]);
      indirectValues[casterIndex * 4] = position.count;
      this.geometries.push(geometry);
    }

    this.casterJobsAttribute = new StorageBufferAttribute(
      new Uint32Array(this.casterCount * capacity),
      1,
    );
    this.matrixValues = new Float32Array(this.casterCount * 16);
    this.matrixColumnsAttribute = new StorageBufferAttribute(
      this.matrixValues,
      4,
    );
    this.rangeValues = new Uint32Array(
      this.casterCount * SHADOW_LEVEL_COUNT * 4,
    );
    this.pageRangesAttribute = new StorageBufferAttribute(this.rangeValues, 4);
    this.depthBiasValues = new Float32Array(this.casterCount);
    this.depthBiasAttribute = new StorageBufferAttribute(
      this.depthBiasValues,
      1,
    );

    const indirectNode = storage(indirect, "uint", indirect.count).toAtomic();
    const casterJobs = storage(
      this.casterJobsAttribute,
      "uint",
      this.casterJobsAttribute.count,
    );
    const ranges = storage(
      this.pageRangesAttribute,
      "uvec4",
      this.pageRangesAttribute.count,
    );
    const pageJobs = storage(
      residency.pageJobsAttribute,
      "uvec4",
      residency.capacity * 3,
    );
    const atlasIndirect = storage(residency.atlasIndirectAttribute, "uint", 8);
    const jobCountIndex = kind === "fixed" ? 1 : 5;
    const pageJobOffset = kind === "fixed" ? 0 : capacity * 2;

    this.resetNode = Fn(() => {
      atomicStore(indirectNode.element(instanceIndex.mul(4).add(1)), 0);
    })().compute(this.casterCount, [1]);

    this.buildNode = Fn(() => {
      const casterIndex = instanceIndex.div(capacity);
      const jobIndex = instanceIndex.mod(capacity);
      If(jobIndex.lessThan(atlasIndirect.element(jobCountIndex)), () => {
        const job = pageJobs.element(jobIndex.add(pageJobOffset));
        const range = ranges.element(
          casterIndex
            .mul(SHADOW_LEVEL_COUNT)
            .add(job.x.div(SHADOW_PAGES_PER_LEVEL)),
        );
        const overlaps = job.z
          .greaterThanEqual(range.x)
          .and(job.w.greaterThanEqual(range.y))
          .and(job.z.lessThanEqual(range.z))
          .and(job.w.lessThanEqual(range.w));
        If(overlaps, () => {
          const casterJobIndex = atomicAdd(
            indirectNode.element(casterIndex.mul(4).add(1)),
            1,
          );
          casterJobs
            .element(casterIndex.mul(capacity).add(casterJobIndex))
            .assign(jobIndex);
        });
      });
    })().compute(this.casterCount * capacity, [64]);
    this.resetNode.name = `V2 ${kind} rigid page work reset`;
    this.buildNode.name = `V2 ${kind} rigid page work`;
  }

  run() {
    this.renderer.compute(this.resetNode);
    this.renderer.compute(this.buildNode);
  }

  update(sources: ShadowCasterEntry[], sunDirection: Vector3) {
    if (sources.length !== this.casterCount)
      throw new Error(
        "Rigid caster count changed without rebuilding the bucket",
      );

    for (let casterIndex = 0; casterIndex < sources.length; casterIndex++) {
      const { mesh: source, depthBias } = sources[casterIndex];
      this.depthBiasValues[casterIndex] = depthBias;
      source.updateWorldMatrix(true, false);
      this.matrixValues.set(source.matrixWorld.elements, casterIndex * 16);
      this.bounds.setFromObject(source, true);
      for (let level = 0; level < SHADOW_LEVEL_COUNT; level++) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let x = 0; x < 2; x++) {
          for (let y = 0; y < 2; y++) {
            for (let z = 0; z < 2; z++) {
              this.corner.set(
                x === 0 ? this.bounds.min.x : this.bounds.max.x,
                y === 0 ? this.bounds.min.y : this.bounds.max.y,
                z === 0 ? this.bounds.min.z : this.bounds.max.z,
              );
              const page = this.coordinates.getPageCoordinate(
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
        this.rangeValues.set(
          [minX, minY, maxX, maxY],
          (casterIndex * SHADOW_LEVEL_COUNT + level) * 4,
        );
      }
    }
    this.matrixColumnsAttribute.needsUpdate = true;
    this.pageRangesAttribute.needsUpdate = true;
    this.depthBiasAttribute.needsUpdate = true;
  }

  updateBiases(sources: ShadowCasterEntry[]) {
    if (sources.length !== this.casterCount)
      throw new Error(
        "Rigid caster count changed without rebuilding the bucket",
      );
    for (let index = 0; index < sources.length; index++)
      this.depthBiasValues[index] = sources[index].depthBias;
    this.depthBiasAttribute.needsUpdate = true;
  }

  dispose() {
    for (const geometry of this.geometries) geometry.dispose();
  }
}
