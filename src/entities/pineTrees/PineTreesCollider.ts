import { ColliderDesc } from "@dimforge/rapier3d";
import { Matrix4, Quaternion, Vector3 } from "three";
import { physicsWorld } from "../../systems";
import { RevoColliderType } from "../../systems/physics/colliderTypes";

// the collider is a unit capsule sized by its scale, diameter in x and height in y
export const createPineTreesColliders = (
  colliderMatrix: Matrix4,
  matrices: Float32Array,
) => {
  const position = new Vector3();
  const quaternion = new Quaternion();
  const size = new Vector3();
  const matrix = new Matrix4();
  for (let index = 0; index < matrices.length / 16; index++) {
    matrix
      .fromArray(matrices, index * 16)
      .multiply(colliderMatrix)
      .decompose(position, quaternion, size);
    const radius = size.x / 2;
    const colliderDesc = ColliderDesc.capsule(size.y / 2 - radius, radius)
      .setTranslation(...position.toArray())
      .setRotation(quaternion)
      .setRestitution(0.5);
    physicsWorld.world.createCollider(colliderDesc).userData = {
      type: RevoColliderType.Wood,
    };
  }
};
