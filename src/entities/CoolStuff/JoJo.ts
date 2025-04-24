import { InstancedMesh, Mesh } from "three";
import { assetManager } from "../../systems/AssetManager";
import { sceneManager } from "../../systems/SceneManager";
import { MeshLambertNodeMaterial } from "three/webgpu";
import {
  color,
  instanceIndex,
  mix,
  positionLocal,
  sin,
  step,
  texture,
  time,
  uv,
  vec2,
} from "three/tsl";
import { tslUtils } from "../../utils/TSLUtils";

export default class JoJo {
  constructor() {
    const mask = assetManager.realmModel.scene.getObjectByName(
      "jojo_mask",
    ) as Mesh;
    mask.material = new MaskMaterial();

    const symbols = assetManager.realmModel.scene.children.filter((child) =>
      child.name.startsWith("jojo_symbol"),
    ) as Mesh[];

    const symbolMaterial = new SymbolMaterial();
    const instancedSymbols = new InstancedMesh(
      symbols[0].geometry,
      symbolMaterial,
      symbols.length,
    );
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      instancedSymbols.setMatrixAt(i, symbol.matrix);
    }

    sceneManager.scene.add(mask, instancedSymbols);
  }
}

class MaskMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.precision = "lowp";
    this.flatShading = true;

    const { stoneDiffuse } = assetManager.atlasesCoords.stones;

    // Diffuse
    const _uvDiff = tslUtils.computeAtlasUv(
      vec2(...stoneDiffuse.scale),
      vec2(...stoneDiffuse.offset),
      uv(),
    );
    const diff = texture(assetManager.stoneAtlas, _uvDiff);
    this.colorNode = diff;
  }
}

class SymbolMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();

    this.precision = "lowp";
    this.flatShading = true;

    // Diffuse
    const purple = color("#eb5694");
    const darkPurple = color("#9642D3");
    this.colorNode = mix(darkPurple, purple, uv().y.mul(0.5)).mul(0.45);

    // Position
    const timer = time.mul(20);
    const offset = sin(timer.add(instanceIndex));
    const sharpOffset = step(0, offset).mul(0.25);
    this.positionNode = positionLocal.add(sharpOffset);
  }
}
