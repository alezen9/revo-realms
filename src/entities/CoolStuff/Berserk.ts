import { assetManager, debugManager } from "../../systems";
import { Mesh } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physicsManager, sceneManager } from "../../systems";
import { RevoColliderType } from "../../types";
import { float, normalMap, texture, uniform, uv } from "three/tsl";

class SwordMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = false;
    const diffuse = texture(assetManager.resources.berserkDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(3.5);
    const normalRoughness = texture(
      assetManager.resources.berserkNormalRoughness,
      uv(),
    );
    this.normalNode = normalMap(normalRoughness.rgb, float(0.5));
    this.roughnessNode = normalRoughness.a;
    this.metalnessNode = float(0.5);
  }
}

export default class Berserk {
  constructor() {
    // Visual
    const sword = assetManager.resources.worldModel.scene.getObjectByName(
      "dragon_slayer",
    ) as Mesh;
    sword.material = new SwordMaterial();
    sceneManager.scene.add(sword);

    // // Physics
    // const swordCollider = assetManager.resources.realmModel.scene.getObjectByName(
    //   "sword_collider",
    // ) as Mesh;
    // const rigidBodyDescAxe = RigidBodyDesc.fixed()
    //   .setTranslation(...swordCollider.position.toArray())
    //   .setRotation(swordCollider.quaternion)
    //   .setUserData({ type: RevoColliderType.Wood });

    // const rigidBodyAxe = physicsManager.world.createRigidBody(rigidBodyDescAxe);
    // const max = swordCollider.geometry.boundingBox!.max;
    // const colliderDescAxe = ColliderDesc.cuboid(
    //   max.x,
    //   max.y,
    //   max.z,
    // ).setRestitution(0.75);
    // physicsManager.world.createCollider(colliderDescAxe, rigidBodyAxe);
  }
}
