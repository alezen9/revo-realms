import { ColliderDesc } from "@dimforge/rapier3d";
import type { Quaternion, Vector3 } from "three";
import { physicsWorld } from "../../../systems";
import { RevoColliderType } from "../../../systems/physics/colliderTypes";

export const createExpedition33FlagCollider = (
  origin: Vector3,
  staffQuaternion: Quaternion,
  staffAxis: Vector3,
  staffSize: Vector3,
) => {
  const height = staffSize.y;
  const radius = staffSize.x / 2;
  const translation = origin.clone().addScaledVector(staffAxis, height / 2);
  const colliderDesc = ColliderDesc.cylinder(height / 2, radius)
    .setTranslation(translation.x, translation.y, translation.z)
    .setRotation(staffQuaternion)
    .setRestitution(0.4);
  physicsWorld.world.createCollider(colliderDesc).userData = {
    type: RevoColliderType.Stone,
  };
};
