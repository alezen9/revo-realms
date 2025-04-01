import { DoubleSide, Mesh } from "three";
import { assetManager } from "../../systems/AssetManager";
import { sceneManager } from "../../systems/SceneManager";
import { MeshLambertNodeMaterial } from "three/webgpu";

class PosterMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super(); // suuuuuprrrrrrr() -cit
    this.map = assetManager.onePieceAtlas;
    this.side = DoubleSide;
  }
}

export default class OnePiece {
  constructor() {
    const posters = assetManager.realmModel.scene.getObjectByName(
      "one_piece_posters",
    ) as Mesh;
    posters.material = new PosterMaterial();
    sceneManager.scene.add(posters);
  }
}
