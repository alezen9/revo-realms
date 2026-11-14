import { ColliderDesc } from "@dimforge/rapier3d";
import type { Mesh } from "three";
import { physicsWorld } from "../../../systems";
import { RevoColliderType } from "../../../systems/physics/colliderTypes";

export const createGokuStatueCollider = (collider: Mesh) => {
  const hx = 0.5 * collider.scale.x;
  const hy = 0.5 * collider.scale.y;
  const hz = 0.5 * collider.scale.z;
  const colliderDesc = ColliderDesc.cuboid(hx, hy, hz)
    .setTranslation(...collider.position.toArray())
    .setRotation(collider.quaternion)
    .setRestitution(0.4);
  physicsWorld.world.createCollider(colliderDesc).userData = {
    type: RevoColliderType.Stone,
  };
};
