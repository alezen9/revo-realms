import { DirectionalLight, Object3D, Vector3 } from "three";
import { State } from "../core/Engine";

export default class Light {
  private light: DirectionalLight;
  private readonly LIGHT_POSITION_OFFSET = new Vector3(2.5, 7.5, 1);
  private target = new Object3D();
  private readonly TARGET_POSITION_OFFSET = new Vector3(-3, 0, -3);

  constructor(state: State) {
    const { scene } = state;

    this.target.position.copy(this.TARGET_POSITION_OFFSET);
    scene.add(this.target);

    this.light = new DirectionalLight("#fcffb5", 2);
    this.light.target = this.target;
    this.light.castShadow = true;
    this.light.shadow.mapSize.width = 256;
    this.light.shadow.mapSize.height = 256;
    this.light.shadow.radius = 3;

    this.light.shadow.camera.near = 0.5;
    this.light.shadow.camera.far = 50;
    this.light.shadow.bias = -0.003;

    scene.add(this.light);
  }

  public getDirection() {
    return this.target.position.normalize();
  }

  public update(state: State) {
    const { player } = state;
    if (!player) return;
    this.light.position
      .copy(player.getPosition())
      .add(this.LIGHT_POSITION_OFFSET);
    this.target.position
      .copy(player.getPosition())
      .add(this.TARGET_POSITION_OFFSET);
  }
}
