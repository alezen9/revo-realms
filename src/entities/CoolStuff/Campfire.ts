import { Mesh, MeshBasicMaterial } from "three";
import { assetManager } from "../../systems/AssetManager";
import { sceneManager } from "../../systems/SceneManager";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { RevoColliderType } from "../../types";
import { physicsManager } from "../../systems/PhysicsManager";
import ParticleSystem from "../../utils/ParticleSystem";

export default class Campfire {
  constructor() {
    // Visual
    const campfire = assetManager.realmModel.scene.getObjectByName(
      "campfire",
    ) as Mesh;
    campfire.material = new MeshBasicMaterial({
      map: assetManager.campfireDiffuse,
    });

    const fire = new ParticleSystem({
      preset: "fire",
      count: 512,
      lifetime: 1,
      height: 2.5,
      radius: 3.75,
    });
    fire.position.copy(campfire.position).setY(-0.5);

    sceneManager.scene.add(campfire, fire);

    // Physics
    const rigidBodyDesc = RigidBodyDesc.fixed()
      .setTranslation(...campfire.position.toArray())
      .setRotation(campfire.quaternion)
      .setUserData({ type: RevoColliderType.Stone });

    const rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);
    campfire.geometry.computeBoundingSphere();
    const { radius } = campfire.geometry.boundingSphere!;
    const colliderDesc = ColliderDesc.ball(radius).setRestitution(0.75);
    physicsManager.world.createCollider(colliderDesc, rigidBody);
  }
}
