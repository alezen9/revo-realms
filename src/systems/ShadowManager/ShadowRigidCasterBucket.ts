import { Box3, BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import { StorageBufferAttribute } from "three/webgpu";
import type { ShadowCasterEntry } from "./ShadowCasterRegistry";
import {
  SHADOW_PAGE_GRID_MIN,
  SHADOW_PAGE_GRID_SIZE,
  SHADOW_PAGE_LEVEL_COUNT,
  ShadowPageCoordinates,
} from "./ShadowPageCoordinates";
import type { ShadowResidency } from "./ShadowResidency";

export class ShadowRigidCasterBucket {
  readonly geometry: BufferGeometry;
  readonly matrixColumnsAttribute: StorageBufferAttribute;
  readonly pageRangesAttribute: StorageBufferAttribute;
  readonly depthBiasAttribute: StorageBufferAttribute;

  private casterCount: number;
  private matrixValues: Float32Array;
  private rangeValues: Uint32Array;
  private depthBiasValues: Float32Array;
  private bounds = new Box3();
  private corner = new Vector3();
  private coordinates = new ShadowPageCoordinates();

  constructor(
    residency: ShadowResidency,
    sources: ShadowCasterEntry[],
    kind: "fixed" | "moving",
  ) {
    this.casterCount = sources.length;
    const chunks: Float32Array[] = [];
    let vertexCount = 0;
    for (const { mesh: source } of sources) {
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
      chunks.push(positions);
      vertexCount += position.count;
      if (sourceGeometry !== source.geometry) sourceGeometry.dispose();
    }

    const positions = new Float32Array(vertexCount * 3);
    const casterIndices = new Float32Array(vertexCount);
    let vertexOffset = 0;
    for (let casterIndex = 0; casterIndex < chunks.length; casterIndex++) {
      const chunk = chunks[casterIndex];
      positions.set(chunk, vertexOffset * 3);
      casterIndices.fill(
        casterIndex,
        vertexOffset,
        vertexOffset + chunk.length / 3,
      );
      vertexOffset += chunk.length / 3;
    }
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new Float32BufferAttribute(positions, 3),
    );
    this.geometry.setAttribute(
      "casterIndex",
      new Float32BufferAttribute(casterIndices, 1),
    );
    this.geometry.setIndirect(
      kind === "fixed"
        ? residency.fixedIndirectAttribute
        : residency.movingIndirectAttribute,
      [(kind === "fixed" ? 4 : 12) * Uint32Array.BYTES_PER_ELEMENT],
    );
    if (kind === "fixed") residency.setFixedVertexCount(vertexCount);
    else residency.setMovingVertexCount(vertexCount);

    this.matrixValues = new Float32Array(this.casterCount * 16);
    this.matrixColumnsAttribute = new StorageBufferAttribute(
      this.matrixValues,
      4,
    );
    this.rangeValues = new Uint32Array(
      this.casterCount * SHADOW_PAGE_LEVEL_COUNT * 4,
    );
    this.pageRangesAttribute = new StorageBufferAttribute(this.rangeValues, 4);
    this.depthBiasValues = new Float32Array(this.casterCount);
    this.depthBiasAttribute = new StorageBufferAttribute(
      this.depthBiasValues,
      1,
    );
  }

  update(sources: ShadowCasterEntry[], sunDirection: Vector3) {
    if (sources.length !== this.casterCount)
      throw new Error(
        "Rigid caster count changed without rebuilding the bucket",
      );

    const maximumPage = SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE - 1;
    for (let casterIndex = 0; casterIndex < sources.length; casterIndex++) {
      const { mesh: source, depthBiasMeters } = sources[casterIndex];
      this.depthBiasValues[casterIndex] = depthBiasMeters;
      source.updateWorldMatrix(true, false);
      this.matrixValues.set(source.matrixWorld.elements, casterIndex * 16);
      this.bounds.setFromObject(source, true);
      for (let level = 0; level < SHADOW_PAGE_LEVEL_COUNT; level++) {
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
        const rangeOffset = (casterIndex * SHADOW_PAGE_LEVEL_COUNT + level) * 4;
        if (
          maxX < SHADOW_PAGE_GRID_MIN ||
          maxY < SHADOW_PAGE_GRID_MIN ||
          minX > maximumPage ||
          minY > maximumPage
        ) {
          this.rangeValues.set([1, 1, 0, 0], rangeOffset);
          continue;
        }
        this.rangeValues[rangeOffset] =
          Math.max(minX, SHADOW_PAGE_GRID_MIN) - SHADOW_PAGE_GRID_MIN;
        this.rangeValues[rangeOffset + 1] =
          Math.max(minY, SHADOW_PAGE_GRID_MIN) - SHADOW_PAGE_GRID_MIN;
        this.rangeValues[rangeOffset + 2] =
          Math.min(maxX, maximumPage) - SHADOW_PAGE_GRID_MIN;
        this.rangeValues[rangeOffset + 3] =
          Math.min(maxY, maximumPage) - SHADOW_PAGE_GRID_MIN;
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
      this.depthBiasValues[index] = sources[index].depthBiasMeters;
    this.depthBiasAttribute.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
  }
}
