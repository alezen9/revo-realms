import { AmbientLight, DirectionalLight, Object3D, Vector3 } from "three";
import { Fn, vec3 } from "three/tsl";
import { State } from "../Game";
import { debugManager } from "./DebugManager";
import { sceneManager } from "./SceneManager";
import { eventsManager } from "./EventsManager";

class LightingSystem {
  private directionalLight: DirectionalLight;

  private ambientLight: AmbientLight;

  // emissive = new EmissiveIllumination();
  private readonly LIGHT_POSITION_OFFSET = new Vector3(50, 70, 50);

  constructor() {
    // this.emissive = new EmissiveIllumination();

    this.directionalLight = this.setupDirectionalLighting();
    sceneManager.scene.add(this.directionalLight);

    this.ambientLight = this.setupAmbientLighting();
    sceneManager.scene.add(this.ambientLight);

    eventsManager.on("update", this.update.bind(this));

    this.debugLight();
  }

  private setupAmbientLighting() {
    const ambientLight = new AmbientLight("white", 0.4);
    ambientLight.intensity = 0.5;
    ambientLight.color.setRGB(1, 0.95, 0.6);
    return ambientLight;
  }

  private setupDirectionalLighting() {
    const directionalLight = new DirectionalLight();
    directionalLight.intensity = 1;
    directionalLight.color.setRGB(1, 0.85, 0.73);
    directionalLight.position.copy(this.LIGHT_POSITION_OFFSET);

    directionalLight.target = new Object3D();

    directionalLight.castShadow = true;

    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;

    const frustumSize = 50;
    directionalLight.shadow.intensity = 0.85;
    directionalLight.shadow.radius = 2;
    directionalLight.shadow.camera.left = -frustumSize;
    directionalLight.shadow.camera.right = frustumSize;
    directionalLight.shadow.camera.top = frustumSize;
    directionalLight.shadow.camera.bottom = -frustumSize;
    directionalLight.shadow.camera.near = 5;
    directionalLight.shadow.camera.far = 175;

    directionalLight.shadow.normalBias = 0.15;
    directionalLight.shadow.bias = 0;

    return directionalLight;
  }

  private debugLight() {
    const lightFolder = debugManager.panel.addFolder({ title: "💡 Light" });
    lightFolder.expanded = false;
    lightFolder.addBinding(this.directionalLight, "color", {
      label: "Directional Color",
      view: "color",
      color: { type: "float" },
    });
    lightFolder.addBinding(this.directionalLight, "intensity", {
      min: 0,
      max: 1,
      label: "Directional intensity",
    });

    lightFolder.addBinding(this.ambientLight, "color", {
      label: "Ambient Color",
      view: "color",
      color: { type: "float" },
    });
    lightFolder.addBinding(this.ambientLight, "intensity", {
      min: 0,
      max: 1,
      label: "Ambient intensity",
    });
  }

  // // Simple version
  // private material_computeAmbientLight = Fn(() => {
  //   return this.uAmbientHue.mul(this.uAmbientIntensity);
  // });

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
  // private material_computeDirectionalLight = Fn(() => {
  //   const wrapFactor = 0.25; // Adjust for smoother blending
  //   const baseShading = dot(normalWorld, this.uDirectionalDirection);
  //   const wrappedShading = baseShading
  //     .mul(float(1.0).sub(wrapFactor))
  //     .add(wrapFactor);
  //   const smoothShading = pow(max(0, wrappedShading), 1.5); // Exponential smoothing
  //   return this.uDirectionalHue
  //     .mul(this.uDirectionalIntensity)
  //     .mul(smoothShading);
  // });

  material_computeIllumination = Fn(() => {
    const light = vec3(0);
    // .add(this.material_computeAmbientLight())
    // .add(this.material_computeDirectionalLight())
    // .add(this.emissive.material_computeEmissiveLight());
    return light;
  });

  setTarget(target: Object3D) {
    this.directionalLight.target = target;
  }

  private update(state: State) {
    const { player } = state;
    this.directionalLight.position
      .copy(player.position)
      .add(this.LIGHT_POSITION_OFFSET);
  }
}

export const lighting = new LightingSystem();
