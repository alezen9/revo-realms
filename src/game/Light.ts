import {
  AmbientLight,
  DirectionalLight,
  Object3D,
  Vector3,
  VSMShadowMap,
} from "three";
import { State } from "../core/Engine";

export default class Light {
  private light: DirectionalLight;
  private readonly LIGHT_POSITION_OFFSET = new Vector3(10, 20, 10);

  private target = new Object3D();

  constructor(state: State) {
    const { scene, renderer } = state;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = VSMShadowMap;

    scene.add(this.target);

    // this.light = new DirectionalLight("#fcffb5", 0.5);
    this.light = new DirectionalLight("#00f", 0.5);
    this.light.target = this.target;
    this.light.castShadow = true;
    this.light.shadow.mapSize.width = 256;
    this.light.shadow.mapSize.height = 256;
    this.light.shadow.radius = 3;

    this.light.shadow.camera.near = 0.5;
    this.light.shadow.camera.far = 50;
    this.light.shadow.bias = -0.003;

    scene.add(this.light);

    const ambient = new AmbientLight("blue", 0.15);
    scene.add(ambient);
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
    this.target.position.copy(player.getPosition());
  }
}
