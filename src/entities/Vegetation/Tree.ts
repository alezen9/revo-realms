import type { Mesh } from "three";
import { assetManager, debugManager, sceneManager } from "../../systems";
import {
  MeshLambertNodeMaterial,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import {
  attribute,
  float,
  hash,
  mix,
  normalMap,
  oscSine,
  positionLocal,
  texture,
  time,
  uniform,
  uv,
  vec3,
  vertexIndex,
} from "three/tsl";

const d = uniform(3.5);
const n = uniform(1.25);

class TreeMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();

    debugManager.panel.addBinding(d, "value");
    debugManager.panel.addBinding(n, "value");

    const isCanopy = attribute("_iscanopy");
    const uvBark = uv(0);
    const uvCanopy = uv(1);
    const diffuseBark = texture(assetManager.resources.treeBarkDiffuse, uvBark);
    const diffuseCanopy = texture(
      assetManager.resources.treeCanopyDiffuse,
      uvCanopy,
    );
    const diffuse = mix(diffuseBark, diffuseCanopy, isCanopy);
    this.colorNode = diffuse.rgb.mul(d);
    this.opacityNode = diffuse.a;
    this.alphaTest = 0.35;

    const normalBark = texture(assetManager.resources.treeBarkNormal, uvBark);
    const normalCanopy = texture(
      assetManager.resources.treeCanopyNormal,
      uvCanopy,
    );
    const normal = mix(normalBark, normalCanopy, isCanopy);
    this.normalNode = normalMap(normal, n);

    const id = hash(vertexIndex);
    const sway = oscSine(time.mul(id).mul(0.25)).mul(0.1).mul(isCanopy);
    this.positionNode = positionLocal.add(vec3(sway, sway, 0));
  }
}

export class Tree {
  constructor() {
    // Visual
    const tree = assetManager.resources.worldModel.scene.getObjectByName(
      "test-tree-2",
    ) as Mesh;
    tree.material = new TreeMaterial();
    // tree.scale.set(2, 2, 2);
    sceneManager.scene.add(tree);
  }
}
