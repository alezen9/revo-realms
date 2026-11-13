import { ColliderDesc } from "@dimforge/rapier3d";
import type { Mesh } from "three";
import { physicsWorld } from "../../systems";
import { RevoColliderType } from "../../systems/physics/colliderTypes";

export const createLakeRocksCollider = (rock: Mesh) => {
  const { geometry, position, quaternion, scale } = rock;
  const vertices = geometry.getAttribute("position").array;
  const hull = Float32Array.from(vertices, (value) => value * scale.x);
  const colliderDesc = ColliderDesc.convexHull(hull);
  if (!colliderDesc) throw new Error("Surfacing lake rock has no hull");
  colliderDesc.setTranslation(...position.toArray()).setRotation(quaternion);
  const collider = physicsWorld.world.createCollider(colliderDesc);
  collider.userData = { type: RevoColliderType.Stone };
};
