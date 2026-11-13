import { assets, graphics, landmarks, stage } from "../../../systems";
import { placeAtAnchor } from "../placeAtAnchor";
import { createLeviathanAxeColliders } from "./LeviathanAxeCollider";
import { debugLeviathanAxe } from "./LeviathanAxeDebug";
import { LeviathanAxeMaterial } from "./LeviathanAxeMaterial";

export class LeviathanAxe {
  constructor() {
    const axe = assets.getMesh(
      "leviathan-axe",
      assets.resources.leviathanAxeModel,
    );
    placeAtAnchor("leviathan-axe", [axe]);
    axe.material = new LeviathanAxeMaterial();

    stage.mainScene.add(axe);
    graphics.vsmPass.registerCaster(axe);
    createLeviathanAxeColliders(axe);

    landmarks.register({
      name: "Leviathan Axe",
      icon: "axe",
      position: axe.position,
      arrivalRadius: 20,
    });
    debugLeviathanAxe();
  }
}
