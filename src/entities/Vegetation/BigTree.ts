import type { Mesh } from "three";
import { assetManager, debugManager, sceneManager } from "../../systems";
import {
  MeshLambertNodeMaterial,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import { float, normalMap, texture, uniform, uv } from "three/tsl";

const c = uniform(4);
const n = uniform(0.8);

class BigTreeMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();
    debugManager.panel.addBinding(c, "value");
    debugManager.panel.addBinding(n, "value");
    // const diffuse = texture(assetManager.resources.bigTreeDiffuse, uv());
    // this.colorNode = diffuse.rgb.mul(c);
    // this.opacityNode = diffuse.a;
    // this.alphaTest = 0.35;

    // const normal = texture(assetManager.resources.bigTreeNormal, uv());
    // this.normalNode = normalMap(normal, n);
  }
}

export class BigTree {
  constructor() {
    // Visual
    const bigTree = assetManager.resources.worldModel.scene.getObjectByName(
      "big_tree_2",
    ) as Mesh;
    bigTree.material = new BigTreeMaterial();
    sceneManager.scene.add(bigTree);
  }
}
