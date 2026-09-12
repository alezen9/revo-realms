import {
  type Box3,
  type Material,
  Matrix4,
  type Mesh,
  type Object3D,
} from "three";
import { type Node, NodeMaterial } from "three/webgpu";
import {
  DYNAMIC_SHADOW_LAYER,
  STATIC_SHADOW_LAYER,
  type ShadowRegistration,
} from "./ShadowSettings";

type ReceiverShadowNode = (factor?: Node<"float">) => Node<"vec3">;

const isMesh = (object: Object3D): object is Mesh =>
  "isMesh" in object && object.isMesh === true;

const isNodeMaterial = (material: Material): material is NodeMaterial =>
  "isNodeMaterial" in material && material.isNodeMaterial === true;

export class ShadowCasterRegistry {
  private casters = new Map<Object3D, Matrix4>();
  private receiverShadowNode: ReceiverShadowNode;

  constructor(receiverShadowNode: ReceiverShadowNode) {
    this.receiverShadowNode = receiverShadowNode;
  }

  register(object: Object3D, registration: ShadowRegistration) {
    const { cast = false, mobility = "static", receive = false } = registration;
    object.updateWorldMatrix(true, true);

    object.traverse((child) => {
      if (!isMesh(child)) return;

      if (cast) {
        child.castShadow = true;
        if (mobility === "dynamic") {
          child.layers.enable(DYNAMIC_SHADOW_LAYER);
        } else {
          child.layers.enable(STATIC_SHADOW_LAYER);
          this.casters.set(child, child.matrixWorld.clone());
        }
      }

      if (!receive) return;
      child.receiveShadow = true;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) this.configureReceiver(material);
    });
  }

  expandBounds(bounds: Box3) {
    for (const caster of this.casters.keys())
      bounds.expandByObject(caster, true);
  }

  haveCastersMoved() {
    let hasMoved = false;
    for (const [object, previousMatrix] of this.casters) {
      object.updateWorldMatrix(true, false);
      if (previousMatrix.equals(object.matrixWorld)) continue;
      previousMatrix.copy(object.matrixWorld);
      hasMoved = true;
    }
    return hasMoved;
  }

  syncCasterMatrices() {
    for (const [object, previousMatrix] of this.casters) {
      object.updateWorldMatrix(true, false);
      previousMatrix.copy(object.matrixWorld);
    }
  }

  private configureReceiver(material: Material) {
    if (!isNodeMaterial(material)) return;
    if (material.receivedShadowNode) return;
    material.receivedShadowNode = this.receiverShadowNode;
    material.needsUpdate = true;
  }
}
