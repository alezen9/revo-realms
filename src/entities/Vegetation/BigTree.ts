import type { Mesh } from "three";
import { assetManager, sceneManager } from "../../systems";

export class BigTree {
  constructor() {
    // Visual
    const bigTree = assetManager.resources.worldModel.scene.getObjectByName(
      "big_tree",
    ) as Mesh;
    console.log(bigTree);
    // sword.material = new SwordMaterial();
    sceneManager.scene.add(bigTree);
  }
}
