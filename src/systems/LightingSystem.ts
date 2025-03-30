import { DirectionalLight, HemisphereLight, Object3D, Vector3 } from "three";
import { Fn, texture, vec2, vec3 } from "three/tsl";
import { State } from "../Game";
import { debugManager } from "./DebugManager";
import { sceneManager } from "./SceneManager";
import { eventsManager } from "./EventsManager";
import { assetManager } from "./AssetManager";

const config = {
  LIGHT_POSITION_OFFSET: new Vector3(10, 10, 10),
};
class LightingSystem {
  private directionalLight: DirectionalLight;
  // private ambientLight: AmbientLight;
  private hemisphereLight: HemisphereLight;
  // emissive = new EmissiveIllumination();

  constructor() {
    // this.emissive = new EmissiveIllumination();

    this.directionalLight = this.setupDirectionalLighting();
    sceneManager.scene.add(this.directionalLight);

    // this.ambientLight = this.setupAmbientLighting();
    // sceneManager.scene.add(this.ambientLight);

    this.hemisphereLight = this.setupHemisphereLight();
    sceneManager.scene.add(this.hemisphereLight);

    eventsManager.on("update", this.update.bind(this));

    this.debugLight();
  }

  // private setupAmbientLighting() {
  //   const ambientLight = new AmbientLight();
  //   ambientLight.intensity = 0.27;
  //   ambientLight.color.setRGB(1.0, 0.95, 0.6);
  //   return ambientLight;
  // }

  private setupHemisphereLight() {
    const hemiLight = new HemisphereLight();
    hemiLight.color.setRGB(0.6, 0.4, 0.5);
    hemiLight.groundColor.setRGB(0.3, 0.2, 0.2);
    hemiLight.intensity = 0.5;
    hemiLight.position.copy(config.LIGHT_POSITION_OFFSET);
    return hemiLight;
  }

  private setupDirectionalLighting() {
    const directionalLight = new DirectionalLight();
    directionalLight.intensity = 0.9;
    directionalLight.color.setRGB(0.85, 0.75, 0.7);
    directionalLight.position.copy(config.LIGHT_POSITION_OFFSET);

    directionalLight.target = new Object3D();

    directionalLight.castShadow = true;

    directionalLight.shadow.mapSize.set(64, 64);

    const frustumSize = 1;
    directionalLight.shadow.intensity = 0.85;
    directionalLight.shadow.camera.left = -frustumSize;
    directionalLight.shadow.camera.right = frustumSize;
    directionalLight.shadow.camera.top = frustumSize;
    directionalLight.shadow.camera.bottom = -frustumSize;
    directionalLight.shadow.camera.near = 0.01;
    directionalLight.shadow.camera.far = 30;

    directionalLight.shadow.normalBias = 0.1;
    directionalLight.shadow.bias = -0.001;

    return directionalLight;
  }

  getTerrainShadowFactor = Fn(([mapUv = vec2(0)]) => {
    const shadowAo = texture(assetManager.terrainShadowAo, mapUv);
    return shadowAo.r;
  });

  private debugLight() {
    const lightFolder = debugManager.panel.addFolder({ title: "💡 Light" });
    lightFolder.expanded = false;
    lightFolder.addBinding(config.LIGHT_POSITION_OFFSET, "x", {
      label: "Sun position X",
    });
    lightFolder.addBinding(config.LIGHT_POSITION_OFFSET, "z", {
      label: "Sun position Z",
    });
    lightFolder.addBinding(config.LIGHT_POSITION_OFFSET, "y", {
      label: "Sun height",
    });
    lightFolder.addBinding(this.directionalLight, "color", {
      label: "Directional Color",
      view: "color",
      color: { type: "float" },
    });
    lightFolder.addBinding(this.directionalLight, "intensity", {
      min: 0,
      max: 5,
      label: "Directional intensity",
    });

    // lightFolder.addBinding(this.ambientLight, "color", {
    //   label: "Ambient Color",
    //   view: "color",
    //   color: { type: "float" },
    // });
    // lightFolder.addBinding(this.ambientLight, "intensity", {
    //   min: 0,
    //   max: 1,
    //   label: "Ambient intensity",
    // });

    lightFolder.addBinding(this.hemisphereLight, "color", {
      label: "Hemisphere sky color",
      view: "color",
      color: { type: "float" },
    });
    lightFolder.addBinding(this.hemisphereLight, "groundColor", {
      label: "Hemisphere ground color",
      view: "color",
      color: { type: "float" },
    });
    lightFolder.addBinding(this.hemisphereLight, "intensity", {
      min: 0,
      max: 1,
      label: "Hemisphere intensity",
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
      .add(config.LIGHT_POSITION_OFFSET);
  }
}

export const lighting = new LightingSystem();
