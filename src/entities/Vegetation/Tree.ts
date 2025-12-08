import type { Mesh } from "three";
import { assetManager, debugManager, sceneManager } from "../../systems";
import { Color, MeshStandardNodeMaterial } from "three/webgpu";
import {
  attribute,
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
  vec4,
  vertexIndex,
} from "three/tsl";

const uniforms = {
  diffuseScale: uniform(4),
  barkNormalScale: uniform(0.75),
  canopyNormalScale: uniform(1.5),
  barkUvScale: uniform(6.6),
  canopyColor: uniform(new Color().setRGB(1, 0, 0)),
  canopyMixFactor: uniform(0.85),
};

class TreeMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super();

    this.debug();

    const isCanopy = attribute("_iscanopy");
    const uvBark = uv(0).mul(uniforms.barkUvScale);
    const uvCanopy = uv(1);
    const diffuseBark = texture(assetManager.resources.treeBarkDiffuse, uvBark);
    const sampleCanopy = texture(
      assetManager.resources.treeCanopyDiffuse,
      uvCanopy,
    );
    const diffuseCanopy = vec4(
      mix(uniforms.canopyColor, sampleCanopy.rgb, uniforms.canopyMixFactor),
      sampleCanopy.a,
    );
    const diffuse = mix(diffuseBark, diffuseCanopy, isCanopy);
    this.colorNode = diffuse.rgb.mul(uniforms.diffuseScale);
    this.opacityNode = diffuse.a;
    this.alphaTest = 0.5;

    const normalSampleBark = texture(
      assetManager.resources.treeBarkNormal,
      uvBark,
    );
    const normalBark = normalMap(normalSampleBark, uniforms.barkNormalScale);

    const normalSampleCanopy = texture(
      assetManager.resources.treeCanopyNormal,
      uvCanopy,
    );
    const normalCanopy = normalMap(
      normalSampleCanopy,
      uniforms.canopyNormalScale,
    );

    const normal = mix(normalBark, normalCanopy, isCanopy);
    this.normalNode = normal;

    const id = hash(vertexIndex);
    const sway = oscSine(time.mul(id).mul(0.15))
      .mul(0.05)
      .mul(isCanopy)
      .mul(positionLocal.x);
    this.positionNode = positionLocal.add(vec3(sway, sway, sway));
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🌳 Trees",
      expanded: false,
    });
    folder.addBinding(uniforms.diffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
    });
    folder.addBinding(uniforms.barkNormalScale, "value", {
      label: "Bark normal scale",
      min: 0,
    });
    folder.addBinding(uniforms.canopyNormalScale, "value", {
      label: "Canopy normal scale",
      min: 0,
    });
    folder.addBinding(uniforms.barkUvScale, "value", {
      label: "Bark UV scale",
      min: 0,
    });
    folder.addBinding(uniforms.canopyColor, "value", {
      label: "Canopy color",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.canopyMixFactor, "value", {
      label: "Canopy mix factor",
      min: 0,
    });
  }
}

export class Tree {
  constructor() {
    // Visual
    const tree = assetManager.resources.worldModel.scene.getObjectByName(
      "maple-tree",
    ) as Mesh;
    tree.material = new TreeMaterial();
    const scale = 6.5;
    tree.scale.set(scale, scale, scale);
    sceneManager.scene.add(tree);
  }
}
