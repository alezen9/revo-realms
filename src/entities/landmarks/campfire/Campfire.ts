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
import { placeAtAnchor } from "../placeAtAnchor";

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
    const { campfireModel } = assets.resources;
    const campfire = assets.getMesh("campfire", campfireModel);
    const fireColliderMesh = assets.getMesh("fire-collider", campfireModel);
    const shortLogColliderMesh = assets.getMesh(
      "log-short-collider",
      campfireModel,
    );
    const longLogColliderMesh = assets.getMesh(
      "log-long-collider",
      campfireModel,
    );
    placeAtAnchor("campfire", [
      campfire,
      fireColliderMesh,
      shortLogColliderMesh,
      longLogColliderMesh,
    ]);
    campfire.material = new CampfireMaterial();

    const fire = new Fire();
    fire.position.copy(campfire.position).setY(-0.15);

    stage.mainScene.add(campfire, fire);
    graphics.vsmPass.registerCaster(campfire);

    const fireColliderBounds = fireColliderMesh.geometry.boundingBox;
    if (!fireColliderBounds)
      throw new Error("fire-collider has no bounding box");
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

    const shortLogColliderBounds = shortLogColliderMesh.geometry.boundingBox;
    if (!shortLogColliderBounds)
      throw new Error("log-short-collider has no bounding box");
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

    const longLogColliderBounds = longLogColliderMesh.geometry.boundingBox;
    if (!longLogColliderBounds)
      throw new Error("log-long-collider has no bounding box");
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
