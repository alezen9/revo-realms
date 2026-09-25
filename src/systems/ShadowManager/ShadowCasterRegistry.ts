import { Matrix4, type BufferGeometry, type Mesh } from "three";
import { BatchedMesh, NodeMaterial, type Node } from "three/webgpu";
import { isPagedV2 } from "./config";

export type ShadowCasterKind = "fixed" | "moving" | "deformed";
export type ShadowDeformedInstances = {
  count: number;
  maxRadiusMeters: number;
  levelCount?: 1 | 2;
  geometry?: BufferGeometry;
  centerWorldPosition: (index: Node<"uint">) => Node<"vec3">;
  worldPosition: (index: Node<"uint">, position: Node<"vec3">) => Node<"vec3">;
  isActive: (index: Node<"uint">) => Node<"bool">;
};
export type ShadowCasterOptions = {
  kind?: ShadowCasterKind;
  depthBiasMeters?: number;
  maxVerticalDisplacementMeters?: number;
  shadowPositionNode?: Node<"vec3">;
  shadowOpacityNode?: Node<"float">;
  alphaCutoff?: number;
  deformedInstances?: ShadowDeformedInstances;
  localVegetation?: boolean;
};

export type ShadowCasterEntry = {
  mesh: Mesh;
  kind: ShadowCasterKind;
  depthBiasMeters: number;
  maxVerticalDisplacementMeters: number;
  shadowPositionNode?: Node<"vec3">;
  shadowOpacityNode?: Node<"float">;
  alphaCutoff: number;
  deformedInstances?: ShadowDeformedInstances;
  localVegetation: boolean;
  revision: number;
  worldMatrix: Matrix4;
};

export class ShadowCasterRegistry {
  private entries = new Map<Mesh, ShadowCasterEntry>();
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

  register(mesh: Mesh, options: ShadowCasterOptions = {}) {
    if (!isPagedV2) return;
    if (this.entries.has(mesh))
      throw new Error(`Shadow caster already registered: ${mesh.name}`);
    const {
      kind = "fixed",
      depthBiasMeters = 0,
      maxVerticalDisplacementMeters = 0,
      shadowPositionNode,
      shadowOpacityNode,
      alphaCutoff = 0,
      deformedInstances,
      localVegetation = false,
    } = options;
    if (localVegetation && (kind !== "deformed" || !deformedInstances))
      throw new Error(
        `Local vegetation needs deformed instances: ${mesh.name}`,
      );
    if (!Number.isFinite(depthBiasMeters) || depthBiasMeters < 0)
      throw new Error(`Invalid shadow depth bias: ${mesh.name}`);
    if (
      !Number.isFinite(maxVerticalDisplacementMeters) ||
      maxVerticalDisplacementMeters < 0
    )
      throw new Error(`Invalid shadow displacement bound: ${mesh.name}`);
    if (!Number.isFinite(alphaCutoff) || alphaCutoff < 0 || alphaCutoff > 1)
      throw new Error(`Invalid shadow alpha cutoff: ${mesh.name}`);
    if (
      deformedInstances &&
      (kind !== "deformed" ||
        !Number.isInteger(deformedInstances.count) ||
        deformedInstances.count <= 0 ||
        !Number.isFinite(deformedInstances.maxRadiusMeters) ||
        deformedInstances.maxRadiusMeters <= 0)
    )
      throw new Error(`Invalid deformed shadow instances: ${mesh.name}`);
    if (
      kind === "deformed" &&
      mesh instanceof BatchedMesh &&
      (!shadowPositionNode || !shadowOpacityNode)
    )
      throw new Error(
        `Batched deformed caster needs shadow nodes: ${mesh.name}`,
      );

    const material = mesh.material;
    if (
      kind === "deformed" &&
      (Array.isArray(material) ||
        !(material instanceof NodeMaterial) ||
        !material.positionNode)
    )
      throw new Error(`Deformed caster needs positionNode: ${mesh.name}`);

    mesh.updateWorldMatrix(true, false);
    this.entries.set(mesh, {
      mesh,
      kind,
      depthBiasMeters,
      maxVerticalDisplacementMeters,
      shadowPositionNode,
      shadowOpacityNode,
      alphaCutoff,
      deformedInstances,
      localVegetation,
      revision: 0,
      worldMatrix: mesh.matrixWorld.clone(),
    });
    this.counts[kind]++;
    if (kind === "fixed") this.fixedVersion++;
    if (kind === "moving") this.movingVersion++;
    if (kind === "deformed") this.deformedVersion++;
  }

  unregister(mesh: Mesh) {
    if (!isPagedV2) return;
    const entry = this.entries.get(mesh);
    if (!entry) throw new Error(`Shadow caster not registered: ${mesh.name}`);

    this.entries.delete(mesh);
    this.counts[entry.kind]--;
    if (entry.kind === "fixed") this.fixedVersion++;
    if (entry.kind === "moving") this.movingVersion++;
    if (entry.kind === "deformed") this.deformedVersion++;
  }

  setDepthBias(mesh: Mesh, depthBiasMeters: number) {
    if (!isPagedV2) return;
    const entry = this.entries.get(mesh);
    if (!entry || entry.kind !== "fixed")
      throw new Error(`Fixed shadow caster not registered: ${mesh.name}`);
    if (!Number.isFinite(depthBiasMeters) || depthBiasMeters < 0)
      throw new Error(`Invalid shadow depth bias: ${mesh.name}`);
    if (entry.depthBiasMeters === depthBiasMeters) return;
    entry.depthBiasMeters = depthBiasMeters;
    this.biasVersion++;
  }

  markMoved(mesh: Mesh) {
    if (!isPagedV2) return;
    const entry = this.entries.get(mesh);
    if (!entry) throw new Error(`Shadow caster not registered: ${mesh.name}`);
    mesh.updateWorldMatrix(true, false);
    if (entry.worldMatrix.equals(mesh.matrixWorld)) return;
    entry.worldMatrix.copy(mesh.matrixWorld);
    entry.revision++;
    if (entry.kind === "fixed") this.fixedRevision++;
    if (entry.kind === "moving") this.movingRevision++;
  }
}
