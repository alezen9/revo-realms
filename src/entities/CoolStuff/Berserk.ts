import { assetManager, debugManager, systemState, landmarkManager } from "../../systems";
import { Mesh } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { physicsManager, sceneManager } from "../../systems";
import { RevoColliderType } from "../../types";
import { normalMap, texture, uniform, uv } from "three/tsl";

const uniforms = {
  uDiffuseScale: uniform(3.75),
  uNormalScale: uniform(1.5),
  uAoScale: uniform(1),
  uMetalnessScale: uniform(1),
  uRoughnessScale: uniform(1.5),
};
class DragonSlayerMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    const diffuse = texture(
      assetManager.resources.dragonSlayerSwordDiffuse,
      uv(),
    );
    this.colorNode = diffuse.rgb.mul(uniforms.uDiffuseScale);
    const normal = texture(
      assetManager.resources.dragonSlayerSwordNormal,
      uv(),
    );
    this.normalNode = normalMap(normal.rgb, uniforms.uNormalScale);

    const orm = texture(assetManager.resources.dragonSlayerSwordARM, uv());
    this.aoNode = orm.r.mul(uniforms.uAoScale);
    this.metalnessNode = orm.b.mul(uniforms.uMetalnessScale);
    this.roughnessNode = orm.g.mul(uniforms.uRoughnessScale);
  }
}

export default class Berserk {
  constructor() {
    this.debug();

    // Visual
    const sword = assetManager.resources.worldModel.scene.getObjectByName(
      "dragon_slayer",
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

    // Register landmark for radial menu discovery
    const landmarkId = landmarkManager.register({
      name: "Dragon Slayer",
      icon: "⚔️",
      position: sword.position,
      discoveryRadius: 80,
      arrivalRadius: 20,
    });

    // Register wind target and link to landmark
    const windTargetId = systemState.wind.registerTarget("Dragon Slayer", sword.position, 20);
    landmarkManager.setWindTargetId(landmarkId, windTargetId);
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🗡️ Berserk",
      expanded: false,
    });
    folder.addBinding(uniforms.uDiffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
    });
    folder.addBinding(uniforms.uNormalScale, "value", {
      label: "Normal scale",
      min: 0,
    });
    folder.addBinding(uniforms.uAoScale, "value", {
      label: "AO scale",
      min: 0,
    });
    folder.addBinding(uniforms.uMetalnessScale, "value", {
      label: "Metalness scale",
      min: 0,
    });
    folder.addBinding(uniforms.uRoughnessScale, "value", {
      label: "Roughness scale",
      min: 0,
    });
  }
}
