import { Box3, Matrix4, type BufferGeometry, type Mesh } from "three";
import { BatchedMesh, NodeMaterial, type Node } from "three/webgpu";

export type ShadowCasterKind = "fixed" | "moving" | "deformed";
export type ShadowGpuInstances = {
  count: number;
  radiusMeters: number;
  geometry?: BufferGeometry;
  baseWorldPosition: (index: Node<"uint">) => Node<"vec3">;
  height: (index: Node<"uint">) => Node<"float">;
  worldPosition: (index: Node<"uint">, position: Node<"vec3">) => Node<"vec3">;
  isActive: (index: Node<"uint">) => Node<"bool">;
};
export type ShadowCasterOptions = {
  motion?: "fixed" | "moving";
  castsShadow?: boolean;
  depthBias?: number;
  opacity?: (uv: Node<"vec2">) => Node<"float">;
  gpuInstances?: ShadowGpuInstances;
};

export type ShadowCasterEntry = {
  mesh: Mesh;
  kind: ShadowCasterKind;
  castsShadow: boolean;
  depthBias: number;
  opacity?: (uv: Node<"vec2">) => Node<"float">;
  alphaTest: number;
  gpuInstances?: ShadowGpuInstances;
  revision: number;
  worldMatrix: Matrix4;
  worldBounds: Box3;
};

export class ShadowCasterRegistry {
  private entries = new Map<Mesh, ShadowCasterEntry>();
  private fixedDirtyBounds: Box3[] = [];
  fixedVersion = 0;
  fixedRevision = 0;
  movingVersion = 0;
  movingRevision = 0;
  deformedVersion = 0;
  biasVersion = 0;
  readonly counts = { fixed: 0, moving: 0, deformed: 0 };

  get casters() {
    return this.entries.values();
  }

  takeFixedDirtyBounds() {
    const bounds = this.fixedDirtyBounds;
    this.fixedDirtyBounds = [];
    return bounds;
  }

  register(mesh: Mesh, options: ShadowCasterOptions = {}) {
    if (this.entries.has(mesh))
      throw new Error(`Shadow caster already registered: ${mesh.name}`);
    const {
      motion = "fixed",
      castsShadow = true,
      depthBias = 0,
      opacity,
      gpuInstances,
    } = options;
    const kind = gpuInstances ? "deformed" : motion;
    if (!Number.isFinite(depthBias) || depthBias < 0)
      throw new Error(`Invalid shadow depth bias: ${mesh.name}`);
    if (
      gpuInstances &&
      (!Number.isInteger(gpuInstances.count) ||
        gpuInstances.count <= 0 ||
        !Number.isFinite(gpuInstances.radiusMeters) ||
        gpuInstances.radiusMeters <= 0)
    )
      throw new Error(`Invalid shadow gpu instances: ${mesh.name}`);
    if (kind !== "fixed" && mesh instanceof BatchedMesh)
      throw new Error(`Batched shadow caster must be fixed: ${mesh.name}`);

    const { material } = mesh;
    const alphaTest = material instanceof NodeMaterial ? material.alphaTest : 0;
    if (opacity && alphaTest <= 0)
      throw new Error(`Shadow opacity needs material alphaTest: ${mesh.name}`);

    mesh.updateWorldMatrix(true, false);
    const worldBounds = new Box3().setFromObject(mesh);
    this.entries.set(mesh, {
      mesh,
      kind,
      castsShadow,
      depthBias,
      opacity,
      alphaTest,
      gpuInstances,
      revision: 0,
      worldMatrix: mesh.matrixWorld.clone(),
      worldBounds,
    });
    if (kind === "fixed") this.fixedDirtyBounds.push(worldBounds.clone());
    this.counts[kind]++;
    this.bumpVersion(kind);
  }

  unregister(mesh: Mesh) {
    const entry = this.entries.get(mesh);
    if (!entry) throw new Error(`Shadow caster not registered: ${mesh.name}`);

    this.entries.delete(mesh);
    if (entry.kind === "fixed") this.fixedDirtyBounds.push(entry.worldBounds);
    this.counts[entry.kind]--;
    this.bumpVersion(entry.kind);
  }

  setDepthBias(mesh: Mesh, depthBias: number) {
    const entry = this.entries.get(mesh);
    if (!entry || entry.kind !== "fixed")
      throw new Error(`Fixed shadow caster not registered: ${mesh.name}`);
    if (!Number.isFinite(depthBias) || depthBias < 0)
      throw new Error(`Invalid shadow depth bias: ${mesh.name}`);
    if (entry.depthBias === depthBias) return;
    entry.depthBias = depthBias;
    this.fixedDirtyBounds.push(entry.worldBounds.clone());
    this.biasVersion++;
  }

  setCastsShadow(mesh: Mesh, castsShadow: boolean) {
    const entry = this.entries.get(mesh);
    if (!entry) throw new Error(`Shadow caster not registered: ${mesh.name}`);
    if (entry.castsShadow === castsShadow) return;
    entry.castsShadow = castsShadow;
    if (entry.kind === "fixed")
      this.fixedDirtyBounds.push(entry.worldBounds.clone());
    this.bumpVersion(entry.kind);
  }

  markMoved(mesh: Mesh) {
    const entry = this.entries.get(mesh);
    if (!entry) throw new Error(`Shadow caster not registered: ${mesh.name}`);
    mesh.updateWorldMatrix(true, false);
    if (entry.worldMatrix.equals(mesh.matrixWorld)) return;
    entry.worldMatrix.copy(mesh.matrixWorld);
    entry.revision++;
    if (!entry.castsShadow) {
      entry.worldBounds.setFromObject(mesh);
      return;
    }
    if (entry.kind === "fixed") {
      this.fixedDirtyBounds.push(entry.worldBounds.clone());
      entry.worldBounds.setFromObject(mesh);
      this.fixedDirtyBounds.push(entry.worldBounds.clone());
      this.fixedRevision++;
    }
    if (entry.kind === "moving") this.movingRevision++;
  }

  private bumpVersion(kind: ShadowCasterKind) {
    if (kind === "fixed") this.fixedVersion++;
    if (kind === "moving") this.movingVersion++;
    if (kind === "deformed") this.deformedVersion++;
  }
}
