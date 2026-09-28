import { Mesh } from "three";
import { RevoColliderType } from "../../../systems/physics/colliderTypes";
import CampfireParticles from "./CampfireParticles";
import {
  assets,
  stage,
  physicsWorld,
  landmarks,
  graphics,
} from "../../../systems";
import { ColliderDesc } from "@dimforge/rapier3d";
import { VSMReceiverStandardMaterial } from "../../../systems/vsm/VSMReceiverMaterials";
import { normalMap, texture, uv } from "three/tsl";

class CampfireMaterial extends VSMReceiverStandardMaterial {
  constructor() {
    super();
    const diffuse = texture(assets.resources.campfireDiffuse, uv());
    this.colorNode = diffuse.rgb.mul(2);
    const normalRoughness = texture(
      assets.resources.campfireNormalRoughness,
      uv(),
    );
    this.normalNode = normalMap(normalRoughness.rgb);
    this.roughnessNode = normalRoughness.a;
  }
}

export class Campfire {
  constructor() {
    // Visual
    const campfire = assets.resources.worldModel.scene.getObjectByName(
      "campfire",
    ) as Mesh;
    campfire.material = new CampfireMaterial();

    const fire = new CampfireParticles({
      preset: "fire",
      count: 2048,
      height: 1.85,
      coneFactor: 1.25,
      speed: 0.5,
      radius: 0.85,
      scale: 0.65,
      bloom: 1.5,
      workGroupSize: 256,
    });
    fire.position.copy(campfire.position).setY(-0.15);

    stage.mainScene.add(campfire, fire);
    graphics.vsmPass.registerCaster(campfire);

    // Physics
    const fireColliderMesh = assets.resources.worldModel.scene.getObjectByName(
      "fire_collider",
    ) as Mesh;
    if (!fireColliderMesh.geometry.boundingBox) {
      fireColliderMesh.geometry.computeBoundingBox();
    }
    const { min: fireMin, max: fireMax } =
      fireColliderMesh.geometry.boundingBox!;
    const fireRadius =
      0.5 * (fireMax.x - fireMin.x) * Math.abs(fireColliderMesh.scale.x);
    const fireColliderDesc = ColliderDesc.ball(fireRadius)
      .setTranslation(...fireColliderMesh.position.toArray())
      .setRotation(fireColliderMesh.quaternion)
      .setRestitution(0.4);
    physicsWorld.world.createCollider(fireColliderDesc).userData = {
      type: RevoColliderType.Stone,
    };

    const shortLogColliderMesh =
      assets.resources.worldModel.scene.getObjectByName(
        "log_short_collider",
      ) as Mesh;
    if (!shortLogColliderMesh.geometry.boundingBox) {
      shortLogColliderMesh.geometry.computeBoundingBox();
    }
    const { min: shortLogMin, max: shortLogMax } =
      shortLogColliderMesh.geometry.boundingBox!;
    const shortLogRadius =
      0.5 *
      Math.max(
        (shortLogMax.x - shortLogMin.x) *
          Math.abs(shortLogColliderMesh.scale.x),
        (shortLogMax.z - shortLogMin.z) *
          Math.abs(shortLogColliderMesh.scale.z),
      );
    const shortLogHalfHeight =
      0.5 *
      (shortLogMax.y - shortLogMin.y) *
      Math.abs(shortLogColliderMesh.scale.y);
    const shortLogColliderDesc = ColliderDesc.cylinder(
      shortLogHalfHeight,
      shortLogRadius,
    )
      .setTranslation(...shortLogColliderMesh.position.toArray())
      .setRotation(shortLogColliderMesh.quaternion)
      .setRestitution(0.5);
    physicsWorld.world.createCollider(shortLogColliderDesc).userData = {
      type: RevoColliderType.Wood,
    };

    const longLogColliderMesh =
      assets.resources.worldModel.scene.getObjectByName(
        "log_long_collider",
      ) as Mesh;
    if (!longLogColliderMesh.geometry.boundingBox) {
      longLogColliderMesh.geometry.computeBoundingBox();
    }
    const { min: longLogMin, max: longLogMax } =
      longLogColliderMesh.geometry.boundingBox!;
    const longLogRadius =
      0.5 *
      Math.max(
        (longLogMax.x - longLogMin.x) * Math.abs(longLogColliderMesh.scale.x),
        (longLogMax.z - longLogMin.z) * Math.abs(longLogColliderMesh.scale.z),
      );
    const longLogHalfHeight =
      0.5 *
      (longLogMax.y - longLogMin.y) *
      Math.abs(longLogColliderMesh.scale.y);
    const longLogColliderDesc = ColliderDesc.cylinder(
      longLogHalfHeight,
      longLogRadius,
    )
      .setTranslation(...longLogColliderMesh.position.toArray())
      .setRotation(longLogColliderMesh.quaternion)
      .setRestitution(0.5);
    physicsWorld.world.createCollider(longLogColliderDesc).userData = {
      type: RevoColliderType.Wood,
    };

    landmarks.register({
      name: "Campfire",
      icon: "fire",
      position: campfire.position,
      arrivalRadius: 15,
    });
  }
}
