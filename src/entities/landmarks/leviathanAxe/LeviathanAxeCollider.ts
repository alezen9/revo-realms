import { ColliderDesc } from "@dimforge/rapier3d";
import { Quaternion, Vector3, type Mesh } from "three";
import { physicsWorld } from "../../../systems";
import { RevoColliderType } from "../../../systems/physics/colliderTypes";

export const createLeviathanAxeColliders = (axe: Mesh) => {
  const scale = axe.scale.x;
  const headPosition = new Vector3(0.1, 0.05, 0)
    .multiplyScalar(scale)
    .applyQuaternion(axe.quaternion)
    .add(axe.position);
  const headRotation = new Quaternion()
    .setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 5)
    .premultiply(axe.quaternion);
  const headColliderDesc = ColliderDesc.cuboid(
    0.4 * scale,
    0.6 * scale,
    0.12 * scale,
  )
    .setTranslation(...headPosition.toArray())
    .setRotation(headRotation)
    .setRestitution(0.4);
  const headCollider = physicsWorld.world.createCollider(headColliderDesc);
  headCollider.userData = {
    type: RevoColliderType.Stone,
  };

  const handlePosition = new Vector3(-1.5, -0.75, 0)
    .multiplyScalar(scale)
    .applyQuaternion(axe.quaternion)
    .add(axe.position);
  const handleRotation = new Quaternion()
    .setFromAxisAngle(new Vector3(0, 0, 1), 0.5 - Math.PI / 2)
    .premultiply(axe.quaternion);
  const handleColliderDesc = ColliderDesc.capsule(1.35 * scale, 0.2 * scale)
    .setTranslation(...handlePosition.toArray())
    .setRotation(handleRotation)
    .setRestitution(0.4);
  const handleCollider = physicsWorld.world.createCollider(handleColliderDesc);
  handleCollider.userData = {
    type: RevoColliderType.Stone,
  };
};
