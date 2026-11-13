import { assets, graphics, landmarks, stage } from "../../../systems";
import { placeAtAnchor } from "../placeAtAnchor";
import { CampfireFire } from "./CampfireFire";
import { createCampfireColliders } from "./CampfireCollider";
import { CampfireMaterial } from "./CampfireMaterial";

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

    const fire = new CampfireFire();
    fire.position.copy(campfire.position).setY(-0.15);

    stage.mainScene.add(campfire, fire);
    graphics.vsmPass.registerCaster(campfire);

    createCampfireColliders(
      fireColliderMesh,
      shortLogColliderMesh,
      longLogColliderMesh,
    );

    landmarks.register({
      name: "Campfire",
      icon: "fire",
      position: campfire.position,
      arrivalRadius: 15,
    });
  }
}
