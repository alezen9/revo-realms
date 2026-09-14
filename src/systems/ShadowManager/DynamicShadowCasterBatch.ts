import {
  Box3,
  BufferGeometry,
  Camera,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  NoBlending,
  type Object3D,
  Scene,
  type Mesh,
  Uint32BufferAttribute,
  Vector2,
  Vector4,
  WebGPUCoordinateSystem,
} from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  attribute,
  float,
  instanceIndex,
  mix,
  positionGeometry,
  uniformArray,
  vec4,
} from "three/tsl";
import type { DynamicShadowLevel } from "./DynamicShadowLevel";

const MAX_ACTIVE_CASTER_COUNT = 24;
const MAX_REGISTERED_CASTER_COUNT = 128;

type CasterRecord = {
  cascadeMask: number;
  hasTransformChanged: boolean;
  instanceIndex?: number;
  isInitialized: boolean;
  localBounds: Box3;
  matrix: Matrix4;
  mesh: Mesh;
  registrationIndex: number;
  worldBounds: Box3;
};

type CasterCandidate = {
  farCoverage: number;
  nearCoverage: number;
  record: CasterRecord;
};

export class DynamicShadowCasterBatch {
  readonly camera = new Camera();
  readonly scene = new Scene();
  private activeRecords: CasterRecord[] = [];
  private atlasHeight: number;
  private atlasWidth: number;
  private cascadeMaskValues: Vector2[] = [];
  private casterSet = new Set<Mesh>();
  private casters: Mesh[] = [];
  private droppedCasterCountValue = 0;
  private eligibleCasterCountValue = 0;
  private isDirty = false;
  private levelCasterBounds: [Box3[], Box3[]] = [[], []];
  private levels: DynamicShadowLevel[];
  private mesh?: InstancedMesh;
  private records: CasterRecord[] = [];
  private sourceCounts = new Map<Mesh, number>();
  private worldMatrix = new Matrix4();

  get isReady() {
    return Boolean(this.mesh);
  }

  get casterCount() {
    return this.activeRecords.length;
  }

  get registeredCasterCount() {
    return this.records.length;
  }

  get eligibleCasterCount() {
    return this.eligibleCasterCountValue;
  }

  get droppedCasterCount() {
    return this.droppedCasterCountValue;
  }

  get triangleCount() {
    const index = this.mesh?.geometry.index;
    return index ? index.count / 3 : 0;
  }

  constructor(
    levels: DynamicShadowLevel[],
    atlasWidth: number,
    atlasHeight: number,
  ) {
    this.levels = levels;
    this.atlasWidth = atlasWidth;
    this.atlasHeight = atlasHeight;
    this.camera.name = "Dynamic shadows";
    this.camera.coordinateSystem = WebGPUCoordinateSystem;
  }

  register(casters: Mesh[]) {
    let nextCasterCount = this.records.length;
    for (const caster of casters) {
      if (this.casterSet.has(caster)) continue;
      nextCasterCount += this.getSourceCount(caster);
    }
    if (nextCasterCount > MAX_REGISTERED_CASTER_COUNT) {
      throw new Error(
        `Dynamic shadow caster limit exceeded: ${nextCasterCount}/${MAX_REGISTERED_CASTER_COUNT}`,
      );
    }

    let hasRegistered = false;
    for (const caster of casters) {
      if (this.casterSet.has(caster)) continue;
      this.casterSet.add(caster);
      this.casters.push(caster);
      hasRegistered = true;
    }
    if (!hasRegistered) return;
    this.rebuildRecords();
  }

  prepare() {
    this.refreshRecords();
    this.updateRecordTransforms();
    let hasChanged = this.updateActiveRecords();
    for (const record of this.activeRecords) {
      if (!record.hasTransformChanged) continue;
      hasChanged = true;
      break;
    }
    if (this.isDirty) this.rebuildMesh();
    return hasChanged;
  }

  getCasterBounds(levelIndex: number) {
    return this.levelCasterBounds[levelIndex];
  }

  private rebuildRecords() {
    let casterCount = 0;
    for (const caster of this.casters)
      casterCount += this.getSourceCount(caster);
    if (casterCount > MAX_REGISTERED_CASTER_COUNT) {
      throw new Error(
        `Dynamic shadow caster limit exceeded: ${casterCount}/${MAX_REGISTERED_CASTER_COUNT}`,
      );
    }

    this.records = [];
    this.sourceCounts.clear();
    let registrationIndex = 0;
    for (const caster of this.casters) {
      const sourceCount = this.getSourceCount(caster);
      this.sourceCounts.set(caster, sourceCount);
      if (!caster.geometry.getAttribute("position")) {
        throw new Error(
          `Dynamic shadow caster "${caster.name || caster.uuid}" has no position attribute`,
        );
      }
      if (!caster.geometry.boundingBox) caster.geometry.computeBoundingBox();
      const boundingBox = caster.geometry.boundingBox;
      if (!boundingBox) {
        throw new Error(
          `Dynamic shadow caster "${caster.name || caster.uuid}" has no bounds`,
        );
      }

      for (
        let instanceIndex = 0;
        instanceIndex < sourceCount;
        instanceIndex++
      ) {
        this.records.push({
          cascadeMask: 0,
          hasTransformChanged: false,
          instanceIndex:
            caster instanceof InstancedMesh ? instanceIndex : undefined,
          isInitialized: false,
          localBounds: boundingBox.clone(),
          matrix: new Matrix4(),
          mesh: caster,
          registrationIndex: registrationIndex++,
          worldBounds: new Box3(),
        });
      }
    }
    this.activeRecords = [];
    this.isDirty = true;
  }

  private refreshRecords() {
    for (const caster of this.casters) {
      if (this.getSourceCount(caster) === this.sourceCounts.get(caster))
        continue;
      this.rebuildRecords();
      return;
    }
  }

  private updateRecordTransforms() {
    for (const caster of this.casters) caster.updateWorldMatrix(true, false);
    for (const record of this.records) {
      this.worldMatrix.copy(record.mesh.matrixWorld);
      if (
        record.mesh instanceof InstancedMesh &&
        record.instanceIndex !== undefined
      ) {
        record.mesh.getMatrixAt(record.instanceIndex, this.worldMatrix);
        this.worldMatrix.premultiply(record.mesh.matrixWorld);
      }
      record.hasTransformChanged =
        !record.isInitialized || !record.matrix.equals(this.worldMatrix);
      if (!record.hasTransformChanged) continue;
      record.isInitialized = true;
      record.matrix.copy(this.worldMatrix);
      record.worldBounds.copy(record.localBounds).applyMatrix4(record.matrix);
    }
  }

  private updateActiveRecords() {
    const candidates: CasterCandidate[] = [];
    for (const record of this.records) {
      if (!this.isHierarchyVisible(record.mesh)) continue;
      const nearCoverage = this.levels[0].getCoverage(record.worldBounds);
      const farCoverage = this.levels[1].getCoverage(record.worldBounds);
      if (nearCoverage === 0 && farCoverage === 0) continue;
      candidates.push({ farCoverage, nearCoverage, record });
    }
    candidates.sort(this.compareCandidates);
    this.eligibleCasterCountValue = candidates.length;
    this.droppedCasterCountValue = Math.max(
      0,
      candidates.length - MAX_ACTIVE_CASTER_COUNT,
    );

    const selectedCandidates = candidates.slice(0, MAX_ACTIVE_CASTER_COUNT);
    selectedCandidates.sort(this.compareRegistrationOrder);
    const nextRecords: CasterRecord[] = [];
    for (const candidate of selectedCandidates) {
      candidate.record.cascadeMask =
        Number(candidate.nearCoverage > 0) |
        (Number(candidate.farCoverage > 0) << 1);
      nextRecords.push(candidate.record);
    }

    let hasChanged = nextRecords.length !== this.activeRecords.length;
    if (!hasChanged) {
      for (let index = 0; index < nextRecords.length; index++) {
        if (nextRecords[index] === this.activeRecords[index]) continue;
        hasChanged = true;
        break;
      }
    }
    if (hasChanged) {
      this.activeRecords = nextRecords;
      this.isDirty = true;
    } else {
      for (let index = 0; index < nextRecords.length; index++) {
        const record = nextRecords[index];
        const value = this.cascadeMaskValues[index];
        const near = Number((record.cascadeMask & 1) !== 0);
        const far = Number((record.cascadeMask & 2) !== 0);
        if (value.x === near && value.y === far) continue;
        value.set(near, far);
        hasChanged = true;
      }
    }

    for (const bounds of this.levelCasterBounds) bounds.length = 0;
    for (const record of nextRecords) {
      if ((record.cascadeMask & 1) !== 0)
        this.levelCasterBounds[0].push(record.worldBounds);
      if ((record.cascadeMask & 2) !== 0)
        this.levelCasterBounds[1].push(record.worldBounds);
    }
    return hasChanged;
  }

  private rebuildMesh() {
    this.disposeMesh();
    this.scene.clear();
    this.cascadeMaskValues = [];

    let vertexCount = 0;
    let indexCount = 0;
    for (const record of this.activeRecords) {
      const position = record.mesh.geometry.getAttribute("position");
      vertexCount += position.count;
      indexCount += record.mesh.geometry.index?.count ?? position.count;
    }
    if (vertexCount === 0 || indexCount === 0) {
      this.isDirty = false;
      return;
    }

    const positions = new Float32Array(vertexCount * 3);
    const objectIndices = new Uint32Array(vertexCount);
    const indices = new Uint32Array(indexCount);
    let vertexOffset = 0;
    let indexOffset = 0;

    for (
      let objectIndex = 0;
      objectIndex < this.activeRecords.length;
      objectIndex++
    ) {
      const record = this.activeRecords[objectIndex];
      const position = record.mesh.geometry.getAttribute("position");
      this.cascadeMaskValues.push(
        new Vector2(
          Number((record.cascadeMask & 1) !== 0),
          Number((record.cascadeMask & 2) !== 0),
        ),
      );
      for (let vertex = 0; vertex < position.count; vertex++) {
        const output = (vertexOffset + vertex) * 3;
        positions[output] = position.getX(vertex);
        positions[output + 1] = position.getY(vertex);
        positions[output + 2] = position.getZ(vertex);
        objectIndices[vertexOffset + vertex] = objectIndex;
      }

      const sourceIndices = record.mesh.geometry.index;
      if (sourceIndices) {
        for (let index = 0; index < sourceIndices.count; index++) {
          indices[indexOffset++] = vertexOffset + sourceIndices.getX(index);
        }
      } else {
        for (let index = 0; index < position.count; index++) {
          indices[indexOffset++] = vertexOffset + index;
        }
      }
      vertexOffset += position.count;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute(
      "shadowObjectIndex",
      new Uint32BufferAttribute(objectIndices, 1),
    );
    geometry.setIndex(new Uint32BufferAttribute(indices, 1));

    this.mesh = new InstancedMesh(
      geometry,
      this.createMaterial(),
      this.levels.length,
    );
    this.mesh.name = "Dynamic shadow casters";
    this.mesh.frustumCulled = false;
    const identity = new Matrix4();
    for (let index = 0; index < this.levels.length; index++) {
      this.mesh.setMatrixAt(index, identity);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.mesh);
    this.isDirty = false;
  }

  private createMaterial() {
    const material = new MeshBasicNodeMaterial({
      blending: NoBlending,
      colorWrite: false,
      depthTest: true,
      depthWrite: true,
    });
    const objectMatrixValues: Matrix4[] = [];
    for (const record of this.activeRecords)
      objectMatrixValues.push(record.matrix);
    const objectMatrices = uniformArray<"mat4">(objectMatrixValues, "mat4");
    const cascadeMasks = uniformArray<"vec2">(this.cascadeMaskValues, "vec2");

    const cascadeMatrixValues: Matrix4[] = [];
    const atlasTransformValues: Vector4[] = [];
    for (const level of this.levels) {
      cascadeMatrixValues.push(level.viewProjectionMatrix);
      const { atlasRegion } = level;
      const scaleX = atlasRegion.size / this.atlasWidth;
      const scaleY = atlasRegion.size / this.atlasHeight;
      const centerX = 2 * (atlasRegion.x / this.atlasWidth) + scaleX - 1;
      const centerY = 1 - 2 * (atlasRegion.y / this.atlasHeight) - scaleY;
      atlasTransformValues.push(new Vector4(scaleX, scaleY, centerX, centerY));
    }
    const cascadeMatrices = uniformArray<"mat4">(cascadeMatrixValues, "mat4");
    const atlasTransforms = uniformArray<"vec4">(atlasTransformValues, "vec4");
    const objectIndex = attribute("shadowObjectIndex", "uint");
    const cascadeMask = cascadeMasks.element(objectIndex);
    const visibility = mix(cascadeMask.x, cascadeMask.y, float(instanceIndex));
    const worldPosition = objectMatrices
      .element(objectIndex)
      .mul(vec4(positionGeometry, 1));
    const cascadeMatrix = cascadeMatrices.element(instanceIndex);
    const atlasTransform = atlasTransforms.element(instanceIndex);
    const clipPosition = cascadeMatrix.mul(worldPosition);
    const atlasX = clipPosition.x
      .mul(atlasTransform.x)
      .add(clipPosition.w.mul(atlasTransform.z));

    material.vertexNode = vec4(
      mix(clipPosition.w.mul(2), atlasX, visibility),
      clipPosition.y
        .mul(atlasTransform.y)
        .add(clipPosition.w.mul(atlasTransform.w)),
      clipPosition.z,
      clipPosition.w,
    );
    return material;
  }

  private disposeMesh() {
    if (!this.mesh) return;
    this.mesh.geometry.dispose();
    const material = this.mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) item.dispose();
    } else {
      material.dispose();
    }
    this.mesh = undefined;
  }

  private isHierarchyVisible(object: Object3D) {
    let current: Object3D | null = object;
    while (current) {
      if (!current.visible) return false;
      current = current.parent;
    }
    return true;
  }

  private getSourceCount(caster: Mesh) {
    return caster instanceof InstancedMesh ? caster.count : 1;
  }

  private compareCandidates(a: CasterCandidate, b: CasterCandidate) {
    const nearPriority =
      Number(b.nearCoverage > 0) - Number(a.nearCoverage > 0);
    if (nearPriority !== 0) return nearPriority;
    const coverageA = Math.max(a.nearCoverage, a.farCoverage);
    const coverageB = Math.max(b.nearCoverage, b.farCoverage);
    if (coverageA !== coverageB) return coverageB - coverageA;
    return a.record.registrationIndex - b.record.registrationIndex;
  }

  private compareRegistrationOrder(a: CasterCandidate, b: CasterCandidate) {
    return a.record.registrationIndex - b.record.registrationIndex;
  }
}
