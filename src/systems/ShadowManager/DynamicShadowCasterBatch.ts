import {
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
  Vector3,
  Vector4,
  WebGPUCoordinateSystem,
} from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  attribute,
  instanceIndex,
  mix,
  positionGeometry,
  uniformArray,
  vec4,
} from "three/tsl";
import type { DynamicShadowLevel } from "./DynamicShadowLevel";

const MAX_ACTIVE_CASTER_COUNT = 24;
const MAX_REGISTERED_CASTER_COUNT = 100;

type CasterEntry = {
  instanceIndex?: number;
  matrix: Matrix4;
  mesh: Mesh;
};

type CasterCandidate = {
  caster: Mesh;
  distanceSquared: number;
};

export class DynamicShadowCasterBatch {
  readonly camera = new Camera();
  readonly scene = new Scene();
  private activeCasters: Mesh[] = [];
  private casters: Mesh[] = [];
  private casterSet = new Set<Mesh>();
  private entries: CasterEntry[] = [];
  private atlasHeight: number;
  private atlasWidth: number;
  private levels: DynamicShadowLevel[];
  private mesh?: InstancedMesh;
  private isDirty = false;
  private totalCasterCount = 0;
  private sourceCounts = new Map<Mesh, number>();
  private worldPosition = new Vector3();
  private worldMatrix = new Matrix4();
  private visibilityValues: number[] = [];

  get isReady() {
    return Boolean(this.mesh);
  }

  get casterCount() {
    return this.entries.length;
  }

  get registeredCasterCount() {
    return this.totalCasterCount;
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
    let newCasterCount = 0;
    for (const caster of casters) {
      if (this.casterSet.has(caster)) continue;
      const sourceCount = this.getSourceCount(caster);
      this.assertSourceCount(caster, sourceCount);
      newCasterCount += sourceCount;
    }
    if (this.totalCasterCount + newCasterCount > MAX_REGISTERED_CASTER_COUNT) {
      throw new Error(
        `Dynamic shadow caster limit exceeded: ${this.totalCasterCount + newCasterCount}/${MAX_REGISTERED_CASTER_COUNT}`,
      );
    }

    for (const caster of casters) {
      if (this.casterSet.has(caster)) continue;
      this.casterSet.add(caster);
      this.casters.push(caster);
      const sourceCount = this.getSourceCount(caster);
      this.sourceCounts.set(caster, sourceCount);
      this.totalCasterCount += sourceCount;
      this.isDirty = true;
    }
  }

  prepare(playerPosition: Vector3) {
    this.refreshSourceCounts();
    this.updateActiveCasters(playerPosition);
    let hasChanged = this.isDirty;
    if (this.isDirty) this.rebuild();
    if (!this.mesh) return hasChanged;

    for (let index = 0; index < this.entries.length; index++) {
      const entry = this.entries[index];
      entry.mesh.updateWorldMatrix(true, false);
      this.worldMatrix.copy(entry.mesh.matrixWorld);
      if (
        entry.mesh instanceof InstancedMesh &&
        entry.instanceIndex !== undefined
      ) {
        entry.mesh.getMatrixAt(entry.instanceIndex, this.worldMatrix);
        this.worldMatrix.premultiply(entry.mesh.matrixWorld);
      }
      if (!entry.matrix.equals(this.worldMatrix)) {
        entry.matrix.copy(this.worldMatrix);
        hasChanged = true;
      }
      const visibility = Number(this.isVisible(entry.mesh));
      if (visibility === this.visibilityValues[index]) continue;
      this.visibilityValues[index] = visibility;
      hasChanged = true;
    }
    return hasChanged;
  }

  private rebuild() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      const material = this.mesh.material;
      if (Array.isArray(material)) {
        for (const item of material) item.dispose();
      } else {
        material.dispose();
      }
    }
    this.scene.clear();
    this.entries = [];
    this.visibilityValues = [];

    let vertexCount = 0;
    let indexCount = 0;
    for (const caster of this.activeCasters) {
      const position = caster.geometry.getAttribute("position");
      if (!position) continue;
      const sourceCount = this.getSourceCount(caster);
      vertexCount += position.count * sourceCount;
      indexCount +=
        (caster.geometry.index?.count ?? position.count) * sourceCount;
    }

    if (vertexCount === 0 || indexCount === 0) {
      this.mesh = undefined;
      this.isDirty = false;
      return;
    }

    const positions = new Float32Array(vertexCount * 3);
    const objectIndices = new Uint32Array(vertexCount);
    const indices = new Uint32Array(indexCount);
    let vertexOffset = 0;
    let indexOffset = 0;

    for (const caster of this.activeCasters) {
      const position = caster.geometry.getAttribute("position");
      if (!position) continue;
      const sourceCount = this.getSourceCount(caster);
      for (
        let instanceIndex = 0;
        instanceIndex < sourceCount;
        instanceIndex++
      ) {
        const objectIndex = this.entries.length;
        this.entries.push({
          instanceIndex:
            caster instanceof InstancedMesh ? instanceIndex : undefined,
          matrix: new Matrix4(),
          mesh: caster,
        });
        this.visibilityValues.push(1);

        for (let vertex = 0; vertex < position.count; vertex++) {
          const output = (vertexOffset + vertex) * 3;
          positions[output] = position.getX(vertex);
          positions[output + 1] = position.getY(vertex);
          positions[output + 2] = position.getZ(vertex);
          objectIndices[vertexOffset + vertex] = objectIndex;
        }

        const sourceIndices = caster.geometry.index;
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
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute(
      "shadowObjectIndex",
      new Uint32BufferAttribute(objectIndices, 1),
    );
    geometry.setIndex(new Uint32BufferAttribute(indices, 1));

    const material = this.createMaterial();
    this.mesh = new InstancedMesh(geometry, material, this.levels.length);
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
    for (const entry of this.entries) objectMatrixValues.push(entry.matrix);
    const objectMatrices = uniformArray<"mat4">(objectMatrixValues, "mat4");

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
    const visibility = uniformArray<"float">(
      this.visibilityValues,
      "float",
    ).element(objectIndex);
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

  private isVisible(object: Object3D) {
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

  private refreshSourceCounts() {
    let total = 0;
    for (const caster of this.casters) {
      const sourceCount = this.getSourceCount(caster);
      this.assertSourceCount(caster, sourceCount);
      total += sourceCount;
      if (sourceCount === this.sourceCounts.get(caster)) continue;
      this.sourceCounts.set(caster, sourceCount);
      this.isDirty = true;
    }
    if (total > MAX_REGISTERED_CASTER_COUNT) {
      throw new Error(
        `Dynamic shadow caster limit exceeded: ${total}/${MAX_REGISTERED_CASTER_COUNT}`,
      );
    }
    this.totalCasterCount = total;
  }

  private updateActiveCasters(playerPosition: Vector3) {
    const candidates: CasterCandidate[] = [];
    for (const caster of this.casters) {
      if (!this.isVisible(caster)) continue;
      candidates.push({
        caster,
        distanceSquared: this.getDistanceSquared(caster, playerPosition),
      });
    }
    candidates.sort(this.compareCandidates);

    const selectedCasters = new Set<Mesh>();
    let activeCasterCount = 0;
    for (const candidate of candidates) {
      const sourceCount = this.getSourceCount(candidate.caster);
      if (activeCasterCount + sourceCount > MAX_ACTIVE_CASTER_COUNT) continue;
      selectedCasters.add(candidate.caster);
      activeCasterCount += sourceCount;
    }

    const nextActiveCasters: Mesh[] = [];
    for (const caster of this.casters) {
      if (selectedCasters.has(caster)) nextActiveCasters.push(caster);
    }

    if (nextActiveCasters.length === this.activeCasters.length) {
      let isSame = true;
      for (let index = 0; index < nextActiveCasters.length; index++) {
        if (nextActiveCasters[index] === this.activeCasters[index]) continue;
        isSame = false;
        break;
      }
      if (isSame) return;
    }

    this.activeCasters = nextActiveCasters;
    this.isDirty = true;
  }

  private getDistanceSquared(caster: Mesh, playerPosition: Vector3) {
    caster.updateWorldMatrix(true, false);
    if (!(caster instanceof InstancedMesh)) {
      this.worldPosition.setFromMatrixPosition(caster.matrixWorld);
      return this.worldPosition.distanceToSquared(playerPosition);
    }

    let distanceSquared = Infinity;
    for (let instanceIndex = 0; instanceIndex < caster.count; instanceIndex++) {
      caster.getMatrixAt(instanceIndex, this.worldMatrix);
      this.worldMatrix.premultiply(caster.matrixWorld);
      this.worldPosition.setFromMatrixPosition(this.worldMatrix);
      distanceSquared = Math.min(
        distanceSquared,
        this.worldPosition.distanceToSquared(playerPosition),
      );
    }
    return distanceSquared;
  }

  private compareCandidates(a: CasterCandidate, b: CasterCandidate) {
    return a.distanceSquared - b.distanceSquared;
  }

  private assertSourceCount(caster: Mesh, sourceCount: number) {
    if (sourceCount <= MAX_ACTIVE_CASTER_COUNT) return;
    throw new Error(
      `Dynamic shadow source "${caster.name || caster.uuid}" has ${sourceCount} instances; split it into spatial batches of at most ${MAX_ACTIVE_CASTER_COUNT}`,
    );
  }
}
