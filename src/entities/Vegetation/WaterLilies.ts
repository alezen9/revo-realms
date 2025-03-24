import { Mesh } from "three";
import {
  fract,
  positionLocal,
  positionWorld,
  sin,
  texture,
  uniform,
} from "three/tsl";
import { sceneManager } from "../../systems/SceneManager";
import { eventsManager } from "../../systems/EventsManager";
import { MeshLambertNodeMaterial } from "three/webgpu";
import { assetManager } from "../../systems/AssetManager";
import { State } from "../../Game";

export class WaterLilies {
  private uTime = uniform(0);

  constructor() {
    const mesh = assetManager.realmModel.scene.getObjectByName(
      "water_lilies",
    ) as Mesh;
    mesh.material = this.createMaterial();
    sceneManager.scene.add(mesh);
    eventsManager.on("update", this.update.bind(this));
  }

  private createMaterial() {
    const node = new MeshLambertNodeMaterial();
    node.precision = "lowp";
    node.transparent = true;
    node.map = assetManager.waterLiliesTexture;
    node.alphaTest = 0.5;
    node.alphaMap = assetManager.waterLiliesAlphaTexture;

    const timer = this.uTime.mul(0.0005);
    const offset = positionWorld.x.mul(0.1);

    const noise = texture(
      assetManager.noiseTexture,
      fract(positionWorld.xz.add(timer).mul(offset)),
    ).b.mul(0.5);

    const wavering = sin(noise);

    node.positionNode = positionLocal.add(wavering);

    return node;
  }

  private update(state: State) {
    const { clock } = state;
    this.uTime.value = clock.getElapsedTime();
  }
}
