import { RevoColliderType } from "../../../systems/physics/colliderTypes";
import { Fire } from "./Fire";
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
    const campfire = assets.getMesh("campfire");
    campfire.material = new CampfireMaterial();

    const fire = new Fire();
    fire.position.copy(campfire.position).setY(-0.15);

    stage.mainScene.add(campfire, fire);
    graphics.vsmPass.registerCaster(campfire);

    const fireColliderMesh = assets.getMesh("fire_collider");
    const fireColliderBounds = fireColliderMesh.geometry.boundingBox;
    if (!fireColliderBounds)
      throw new Error("fire_collider has no bounding box");
    const { min: fireMin, max: fireMax } = fireColliderBounds;
    const fireRadius =
      0.5 * (fireMax.x - fireMin.x) * Math.abs(fireColliderMesh.scale.x);
    const fireColliderDesc = ColliderDesc.ball(fireRadius)
      .setTranslation(...fireColliderMesh.position.toArray())
      .setRotation(fireColliderMesh.quaternion)
      .setRestitution(0.4);
    physicsWorld.world.createCollider(fireColliderDesc).userData = {
      type: RevoColliderType.Stone,
    };

    const shortLogColliderMesh = assets.getMesh("log_short_collider");
    const shortLogColliderBounds = shortLogColliderMesh.geometry.boundingBox;
    if (!shortLogColliderBounds)
      throw new Error("log_short_collider has no bounding box");
    const { min: shortLogMin, max: shortLogMax } = shortLogColliderBounds;
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

    const longLogColliderMesh = assets.getMesh("log_long_collider");
    const longLogColliderBounds = longLogColliderMesh.geometry.boundingBox;
    if (!longLogColliderBounds)
      throw new Error("log_long_collider has no bounding box");
    const { min: longLogMin, max: longLogMax } = longLogColliderBounds;
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
