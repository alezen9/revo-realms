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
  uniform,
  uv,
} from "three/tsl";
import { eventsManager } from "../../systems/EventsManager";

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

    const stoneColor = texture(assetManager.stoneDiffuse, uv());
    this.colorNode = stoneColor;
  }
}

class SymbolMaterial extends MeshLambertNodeMaterial {
  private uTime = uniform(0);
  constructor() {
    super();

    eventsManager.on("update", ({ clock }) => {
      this.uTime.value = clock.getElapsedTime();
    });

    this.createMaterial();
  }

  private createMaterial() {
    this.precision = "lowp";
    this.flatShading = true;

    // Diffuse
    const purple = color("#eb5694");
    const darkPurple = color("#9642D3");
    this.colorNode = mix(darkPurple, purple, uv().y.mul(0.5)).mul(0.45);

    // Position
    const timer = this.uTime.mul(20);
    const offset = sin(timer.add(instanceIndex));
    const sharpOffset = step(0, offset).mul(0.25);
    this.positionNode = positionLocal.add(sharpOffset);
  }
}
