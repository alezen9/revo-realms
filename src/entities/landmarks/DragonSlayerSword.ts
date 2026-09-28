import {
  assets,
  debugPanel,
  landmarks,
  physicsWorld,
  stage,
  graphics,
} from "../../systems";
import { ColliderDesc } from "@dimforge/rapier3d";
import { Vector3 } from "three";
import { VSMReceiverStandardMaterial } from "../../systems/vsm/VSMReceiverMaterials";
import { normalMap, texture, uniform, uv } from "three/tsl";
import { RevoColliderType } from "../../systems/physics/colliderTypes";

const uniforms = {
  uDiffuseScale: uniform(3.75),
  uNormalScale: uniform(1.5),
  uAoScale: uniform(1),
  uMetalnessScale: uniform(1),
  uRoughnessScale: uniform(1.5),
};
class DragonSlayerMaterial extends VSMReceiverStandardMaterial {
  constructor() {
    super();
    const diffuse = texture(assets.resources.dragonSlayerSwordDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(uniforms.uDiffuseScale);
    const normal = texture(assets.resources.dragonSlayerSwordNormal, uv());
    this.normalNode = normalMap(normal.rgb, uniforms.uNormalScale);

    const orm = texture(assets.resources.dragonSlayerSwordARM, uv());
    this.aoNode = orm.r.mul(uniforms.uAoScale);
    this.metalnessNode = orm.b.mul(uniforms.uMetalnessScale);
    this.roughnessNode = orm.g.mul(uniforms.uRoughnessScale);
  }
}

export class DragonSlayerSword {
  constructor() {
    const sword = assets.getMesh("dragon_slayer");
    sword.material = new DragonSlayerMaterial();
    stage.mainScene.add(sword);
    graphics.vsmPass.registerCaster(sword);

    sword.geometry.computeBoundingBox();
    const bounds = sword.geometry.boundingBox;
    if (!bounds) throw new Error("Dragon Slayer has no bounding box");

    const colliderSize = bounds.getSize(new Vector3()).multiply(sword.scale);
    colliderSize.x *= 0.7;
    const colliderCenter = bounds
      .getCenter(new Vector3())
      .multiply(sword.scale)
      .applyQuaternion(sword.quaternion)
      .add(sword.position);
    const colliderDesc = ColliderDesc.cuboid(
      colliderSize.x / 2,
      colliderSize.y / 2,
      colliderSize.z / 2,
    )
      .setTranslation(...colliderCenter.toArray())
      .setRotation(sword.quaternion)
      .setRestitution(0.4);
    const collider = physicsWorld.world.createCollider(colliderDesc);
    collider.userData = {
      type: RevoColliderType.Stone,
    };

    landmarks.register({
      name: "Dragon Slayer",
      icon: "sword",
      position: sword.position,
      arrivalRadius: 20,
    });
    this.debug();
  }

  private debug() {
    const folder = debugPanel.panel.addFolder({
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
