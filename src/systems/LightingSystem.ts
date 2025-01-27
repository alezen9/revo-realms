import {
  AmbientLight,
  Color,
  DirectionalLight,
  Object3D,
  Scene,
  Vector3,
} from "three";
import EmissiveIllumination from "./EmissiveIllumination";
import {
  dot,
  float,
  Fn,
  max,
  normalWorld,
  pow,
  uniform,
  vec3,
} from "three/tsl";
import { State } from "../Game";

export default class LightingSystem {
  private directionalLight: DirectionalLight;
  private uDirectionalHue = uniform(new Color());
  private uDirectionalIntensity = uniform(0);
  private uDirectionalDirection = uniform(new Vector3());

  private ambientLight: AmbientLight;
  private uAmbientHue = uniform(new Color());
  private uAmbientIntensity = uniform(0);

  emissive = new EmissiveIllumination();
  private readonly LIGHT_POSITION_OFFSET = new Vector3(10, 20, 10);

  private target = new Object3D();

  constructor(scene: Scene) {
    this.emissive = new EmissiveIllumination();

    scene.add(this.target);

    this.directionalLight = this.setupDirectionalLighting();
    scene.add(this.directionalLight);

    this.ambientLight = this.setupAmbientLighting();
    scene.add(this.ambientLight);
  }

  private setupAmbientLighting() {
    const ambientLight = new AmbientLight("white", 0.3);
    this.uAmbientHue.value.copy(ambientLight.color);
    this.uAmbientIntensity.value = ambientLight.intensity;
    return ambientLight;
  }

  private setupDirectionalLighting() {
    const directionalLight = new DirectionalLight("white", 1);
    directionalLight.position.copy(this.LIGHT_POSITION_OFFSET);
    this.uDirectionalHue.value.copy(directionalLight.color);
    this.uDirectionalIntensity.value = directionalLight.intensity;
    this.uDirectionalDirection.value.copy(
      directionalLight.position.sub(this.target.position).normalize(),
    );

    directionalLight.target = this.target;

    directionalLight.castShadow = true;

    directionalLight.shadow.intensity = 0.5;
    directionalLight.shadow.mapSize.width = 256;
    directionalLight.shadow.mapSize.height = 256;
    directionalLight.shadow.radius = 3;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.bias = -0.003;

    return directionalLight;
  }

  // Simple version
  private material_computeAmbientLight = Fn(() => {
    return this.uAmbientHue.mul(this.uAmbientIntensity);
  });

  // Enhanced version (Hemisphere light)
  // private material_computeAmbientLight = Fn(() => {
  //   // const skyHue = vec3(0.6, 0.8, 1.0); // Sky color
  //   // const groundHue = vec3(0.2, 0.2, 0.2); // Ground color
  //   const ambientFactor = normalWorld.y.mul(0.5).add(0.5); // Blend based on surface normal
  //   return mix(this.uGroundHue, this.uSkyHue, ambientFactor).mul(
  //     this.uAmbientIntensity,
  //   );
  // });

  // Simple version
  // private material_computeDirectionalLight = Fn(() => {
  //   const shading = max(0, dot(normalWorld, this.uDirectionalDirection));
  //   return this.uDirectionalHue.mul(this.uDirectionalIntensity).mul(shading);
  // });

  // Enhanced version
  private material_computeDirectionalLight = Fn(() => {
    const wrapFactor = 0.25; // Adjust for smoother blending
    const baseShading = dot(normalWorld, this.uDirectionalDirection);
    const wrappedShading = baseShading
      .mul(float(1.0).sub(wrapFactor))
      .add(wrapFactor);
    const smoothShading = pow(max(0, wrappedShading), 1.5); // Exponential smoothing
    return this.uDirectionalHue
      .mul(this.uDirectionalIntensity)
      .mul(smoothShading);
  });

  material_computeIllumination = Fn(() => {
    const light = vec3(0)
      .add(this.material_computeAmbientLight())
      .add(this.material_computeDirectionalLight());
    // .add(this.emissive.material_computeEmissiveLight());
    return light;
  });

  public update(state: State) {
    const { player } = state;
    if (!player) return;
    this.directionalLight.position
      .copy(player.getPosition())
      .add(this.LIGHT_POSITION_OFFSET);
    this.target.position.copy(player.getPosition());
  }
}
