import { assetManager, debugManager } from "../../systems";
import { Mesh } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physicsManager, sceneManager } from "../../systems";
import { RevoColliderType } from "../../types";
import { normalMap, texture, uniform, uv } from "three/tsl";

const uniforms = {
  diffuseScale: uniform(3.75),
  normalScale: uniform(1.5),
  aoScale: uniform(1),
  metalnessScale: uniform(1),
  roughnessScale: uniform(1.5),
};
class DragonSlayerMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();

    this.debug();

    this.precision = "lowp";
    const diffuse = texture(assetManager.resources.berserkDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(uniforms.diffuseScale);
    const normal = texture(assetManager.resources.berserkNormal, uv());
    this.normalNode = normalMap(normal.rgb, uniforms.normalScale);

    const orm = texture(assetManager.resources.berserkORM, uv());
    this.aoNode = orm.r.mul(uniforms.aoScale);
    this.metalnessNode = orm.b.mul(uniforms.metalnessScale);
    this.roughnessNode = orm.g.mul(uniforms.roughnessScale);
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🗡️ Berserk",
      expanded: false,
    });
    folder.addBinding(uniforms.diffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
    });
    folder.addBinding(uniforms.normalScale, "value", {
      label: "Normal scale",
      min: 0,
    });
    folder.addBinding(uniforms.aoScale, "value", {
      label: "AO scale",
      min: 0,
    });
    folder.addBinding(uniforms.metalnessScale, "value", {
      label: "Metalness scale",
      min: 0,
    });
    folder.addBinding(uniforms.roughnessScale, "value", {
      label: "Roughness scale",
      min: 0,
    });
  }
}

export default class Berserk {
  constructor() {
    // Visual
    const sword = assetManager.resources.worldModel.scene.getObjectByName(
      "dragon_slayer_optimized",
    ) as Mesh;
    sword.material = new DragonSlayerMaterial();
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
