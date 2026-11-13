import { ColliderDesc } from "@dimforge/rapier3d";
import { Vector3, type Mesh } from "three";
import { physicsWorld } from "../../../systems";
import { RevoColliderType } from "../../../systems/physics/colliderTypes";

export const createDragonSlayerSwordCollider = (sword: Mesh) => {
  sword.geometry.computeBoundingBox();
  const bounds = sword.geometry.boundingBox;
  if (!bounds) throw new Error("Dragon Slayer has no bounding box");

  const colliderSize = bounds.getSize(new Vector3()).multiply(sword.scale);
  colliderSize.x *= 0.7;
  const colliderCenter = bounds
    .getCenter(new Vector3())
    .multiply(sword.scale)
    .applyQuaternion(sword.quaternion)
    .add(sword.position);
  const colliderDesc = ColliderDesc.cuboid(
    colliderSize.x / 2,
    colliderSize.y / 2,
    colliderSize.z / 2,
  )
    .setTranslation(...colliderCenter.toArray())
    .setRotation(sword.quaternion)
    .setRestitution(0.4);
  const collider = physicsWorld.world.createCollider(colliderDesc);
  collider.userData = {
    type: RevoColliderType.Stone,
  };
};
