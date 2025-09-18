import {
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Object3D,
  Vector3,
} from "three";
import { Fn, texture, vec2 } from "three/tsl";
import { debugManager } from "./DebugManager";
import { sceneManager } from "./SceneManager";
import { eventsManager } from "./EventsManager";
import { assetManager } from "./AssetManager";

const config = {
  LIGHT_POSITION_OFFSET: new Vector3(10, 10, 10),
  // directionalColor: new Color(0.53, 0.65, 0.79), // Dark
  // directionalIntensity: 0.16, // Dark
  directionalColor: new Color(0.85, 0.75, 0.7), // Light
  directionalIntensity: 0.8, // Light
  // hemiSkyColor: new Color(0.4, 0.45, 0.6), // Dark
  // hemiGroundColor: new Color(0.3, 0.2, 0.2), // Dark
  hemiSkyColor: new Color(0.6, 0.4, 0.5), // Light
  hemiGroundColor: new Color(0.3, 0.2, 0.2), // Light
  hemiIntensity: 0.3,
  // fogColor: new Color(0.05, 0.12, 0.24), // Dark
  // fogDensity: 0.009, // Dark
  fogColor: new Color(0.29, 0.08, 0.0), // Light
  fogDensity: 0.0046, // Light
};

class LightingSystem {
  private directionalLight: DirectionalLight;
  // private ambientLight: AmbientLight;
  private hemisphereLight: HemisphereLight;
  // emissive = new EmissiveIllumination();
  private fog: FogExp2;

  constructor() {
    // this.emissive = new EmissiveIllumination();

    this.directionalLight = this.setupDirectionalLighting();
    sceneManager.scene.add(this.directionalLight);

    // this.ambientLight = this.setupAmbientLighting();
    // sceneManager.scene.add(this.ambientLight);

    this.hemisphereLight = this.setupHemisphereLight();
    sceneManager.scene.add(this.hemisphereLight);

    this.fog = this.setupFog();
    // sceneManager.scene.fog = this.fog;

    // eventsManager.on("camera-changed", () => {
    //   sceneManager.scene.fog = sceneManager.scene.fog ? null : this.fog;
    // });

    eventsManager.on("update", ({ player }) => {
      this.directionalLight.position
        .copy(player.position)
        .add(config.LIGHT_POSITION_OFFSET);
    });

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
    hemiLight.color.copy(config.hemiSkyColor);
    hemiLight.groundColor.copy(config.hemiGroundColor);
    hemiLight.intensity = 0.3;
    hemiLight.position.copy(config.LIGHT_POSITION_OFFSET);
    return hemiLight;
  }

  private setupDirectionalLighting() {
    const directionalLight = new DirectionalLight();
    directionalLight.intensity = config.directionalIntensity;
    directionalLight.color.copy(config.directionalColor);
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

  private setupFog() {
    const fog = new FogExp2(config.fogColor, config.fogDensity);
    return fog;
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
    lightFolder.addBinding(this.fog, "color", {
      label: "Fog Color",
      view: "color",
      color: { type: "float" },
    });
    lightFolder.addBinding(this.fog, "density", {
      label: "Fog Density",
      min: 0,
      max: 0.025,
      step: 0.0001,
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

  setTarget(target: Object3D) {
    this.directionalLight.target = target;
  }
}

export const lighting = new LightingSystem();
