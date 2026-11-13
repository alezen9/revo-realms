import { assets, landmarks, stage, graphics } from "../../../systems";
import { placeAtAnchor } from "../placeAtAnchor";
import { createDragonSlayerSwordCollider } from "./DragonSlayerSwordCollider";
import { debugDragonSlayerSword } from "./DragonSlayerSwordDebug";
import { DragonSlayerSwordMaterial } from "./DragonSlayerSwordMaterial";

export class DragonSlayerSword {
  constructor() {
    const sword = assets.getMesh(
      "dragon-slayer",
      assets.resources.dragonSlayerModel,
    );
    placeAtAnchor("dragon-slayer", [sword]);
    sword.material = new DragonSlayerSwordMaterial();
    stage.mainScene.add(sword);
    graphics.vsmPass.registerCaster(sword);
    createDragonSlayerSwordCollider(sword);

    landmarks.register({
      name: "Dragon Slayer",
      icon: "sword",
      position: sword.position,
      arrivalRadius: 20,
    });
    debugDragonSlayerSword();
  }
}
