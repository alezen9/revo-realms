import { InstancedMesh, Mesh } from "three";
import { assetManager } from "../../systems/AssetManager";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { RevoColliderType } from "../../types";
import { physicsManager } from "../../systems/PhysicsManager";
import { sceneManager } from "../../systems/SceneManager";
import { texture, uniform, uv } from "three/tsl";

class KunaiMaterial extends MeshBasicNodeMaterial {
  uScale = uniform(1);
  constructor() {
    super();
    // Diffuse
    const diffuse = texture(assetManager.kunaiDiffuse, uv());
    this.colorNode = diffuse.mul(0.5);
  }
}

export default class Naruto {
  constructor() {
    const colliders = assetManager.realmModel.scene.children.filter(
      ({ name }) => name.startsWith("kunai_collider"),
    ) as Mesh[];
    const kunai = assetManager.realmModel.scene.getObjectByName(
      "base_kunai",
    ) as Mesh;

    const material = new KunaiMaterial();
    const instances = new InstancedMesh(
      kunai.geometry,
      material,
      colliders.length,
    );
    colliders.forEach((colliderBox, i) => {
      instances.setMatrixAt(i, colliderBox.matrix);
      // Physics
      const rigidBodyDesc = RigidBodyDesc.fixed()
        .setTranslation(...colliderBox.position.toArray())
        .setRotation(colliderBox.quaternion)
        .setUserData({ type: RevoColliderType.Wood });

      const rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);
      colliderBox.geometry.computeBoundingBox();
      const { x, y, z } = colliderBox.geometry.boundingBox!.max;
      const colliderDesc = ColliderDesc.cuboid(x, y, z).setRestitution(0.75);
      physicsManager.world.createCollider(colliderDesc, rigidBody);
    });
    sceneManager.scene.add(instances);
  }
}
