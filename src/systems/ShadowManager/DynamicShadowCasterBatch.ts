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

type CasterEntry = {
  matrix: Matrix4;
  mesh: Mesh;
};

export class DynamicShadowCasterBatch {
  readonly camera = new Camera();
  readonly scene = new Scene();
  private casters: Mesh[] = [];
  private casterSet = new Set<Mesh>();
  private entries: CasterEntry[] = [];
  private atlasHeight: number;
  private atlasWidth: number;
  private levels: DynamicShadowLevel[];
  private mesh?: InstancedMesh;
  private isDirty = false;
  private visibilityValues: number[] = [];

  get isReady() {
    return Boolean(this.mesh);
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
    for (const caster of casters) {
      if (this.casterSet.has(caster)) continue;
      this.casterSet.add(caster);
      this.casters.push(caster);
      this.isDirty = true;
    }
  }

  prepare() {
    let hasChanged = this.isDirty;
    if (this.isDirty) this.rebuild();
    if (!this.mesh) return hasChanged;

    for (let index = 0; index < this.entries.length; index++) {
      const entry = this.entries[index];
      entry.mesh.updateWorldMatrix(true, false);
      if (!entry.matrix.equals(entry.mesh.matrixWorld)) {
        entry.matrix.copy(entry.mesh.matrixWorld);
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
    for (const caster of this.casters) {
      const position = caster.geometry.getAttribute("position");
      if (!position) continue;
      vertexCount += position.count;
      indexCount += caster.geometry.index?.count ?? position.count;
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

    for (const caster of this.casters) {
      const position = caster.geometry.getAttribute("position");
      if (!position) continue;

      const objectIndex = this.entries.length;
      this.entries.push({ matrix: new Matrix4(), mesh: caster });
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
}
