import { InstancedMesh, Mesh } from "three";
import { assetManager } from "../../systems/AssetManager";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { RevoColliderType } from "../../types";
import { physicsManager } from "../../systems/PhysicsManager";
import { sceneManager } from "../../systems/SceneManager";
import { texture, uniform, uv } from "three/tsl";

class KunaiMaterial extends MeshStandardNodeMaterial {
  uScale = uniform(1);
  constructor() {
    super();
    // Diffuse
    const diffuse = texture(assetManager.kunaiDiffuse, uv());
    this.colorNode = diffuse.mul(5);

    const mr = texture(assetManager.kunaiMR, uv());
    this.metalnessNode = mr.g;
    this.roughnessNode = mr.b;
  }
}

export default class Naruto {
  constructor() {
    const kunais = assetManager.realmModel.scene.children.filter(({ name }) =>
      name.startsWith("kunai"),
    ) as Mesh[];
    const baseKunai = assetManager.realmModel.scene.getObjectByName(
      "base_kunai",
    ) as Mesh;

    const material = new KunaiMaterial();

    const instances = new InstancedMesh(
      baseKunai.geometry,
      material,
      kunais.length,
    );

    const { x, y, z } = baseKunai.geometry.boundingBox!.max;

    kunais.forEach((kunai, i) => {
      instances.setMatrixAt(i, kunai.matrix);
      // Physics
      const rigidBodyDesc = RigidBodyDesc.fixed()
        .setTranslation(...kunai.position.toArray())
        .setRotation(kunai.quaternion)
        .setUserData({ type: RevoColliderType.Wood });

      const rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);
      const colliderDesc = ColliderDesc.cuboid(x, y, z).setRestitution(0.75);
      physicsManager.world.createCollider(colliderDesc, rigidBody);
    });
    sceneManager.scene.add(instances);
  }
}
