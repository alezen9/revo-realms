import { assets, graphics, landmarks, stage } from "../../../systems";
import { placeAtAnchor } from "../placeAtAnchor";
import { createGokuStatueCollider } from "./GokuStatueCollider";
import { debugGokuStatue } from "./GokuStatueDebug";
import { GokuStatueMaterial } from "./GokuStatueMaterial";

export class GokuStatue {
  private shadowSettings = { depthBias: 0 };

  constructor() {
    const { gokuStatueModel } = assets.resources;
    const gokuStatue = assets.getMesh("goku-statue", gokuStatueModel);
    const collider = assets.getMesh("goku-statue-collider", gokuStatueModel);
    placeAtAnchor("goku-statue", [gokuStatue, collider]);
    gokuStatue.material = new GokuStatueMaterial();
    stage.mainScene.add(gokuStatue);
    graphics.vsmPass.registerCaster(gokuStatue, this.shadowSettings);
    createGokuStatueCollider(collider);

    landmarks.register({
      name: "Goku Statue",
      icon: "dragonball",
      position: gokuStatue.position,
      arrivalRadius: 20,
    });
    debugGokuStatue(gokuStatue, this.shadowSettings);
  }
}
