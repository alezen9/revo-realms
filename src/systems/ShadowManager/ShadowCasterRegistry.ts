import { Matrix4, type Mesh } from "three";
import { NodeMaterial } from "three/webgpu";
import { isPagedV2 } from "./config";

export type ShadowCasterKind = "fixed" | "moving" | "deformed";

export type ShadowCasterEntry = {
  mesh: Mesh;
  kind: ShadowCasterKind;
  revision: number;
  worldMatrix: Matrix4;
};

export class ShadowCasterRegistry {
  private entries = new Map<Mesh, ShadowCasterEntry>();
  readonly counts = { fixed: 0, moving: 0, deformed: 0 };

  get casters() {
    return this.entries.values();
  }

  register(mesh: Mesh, kind: ShadowCasterKind = "fixed") {
    if (!isPagedV2) return;
    if (this.entries.has(mesh))
      throw new Error(`Shadow caster already registered: ${mesh.name}`);

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
      revision: 0,
      worldMatrix: mesh.matrixWorld.clone(),
    });
    this.counts[kind]++;
  }

  unregister(mesh: Mesh) {
    if (!isPagedV2) return;
    const entry = this.entries.get(mesh);
    if (!entry) throw new Error(`Shadow caster not registered: ${mesh.name}`);

    this.entries.delete(mesh);
    this.counts[entry.kind]--;
  }

  markMoved(mesh: Mesh) {
    if (!isPagedV2) return;
    const entry = this.entries.get(mesh);
    if (!entry || entry.kind === "fixed")
      throw new Error(`Moving shadow caster not registered: ${mesh.name}`);
    mesh.updateWorldMatrix(true, false);
    if (entry.worldMatrix.equals(mesh.matrixWorld)) return;
    entry.worldMatrix.copy(mesh.matrixWorld);
    entry.revision++;
  }
}
