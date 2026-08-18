import {
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Object3D,
  Vector3,
} from "three";
import { type SceneManager } from "./SceneManager";
import { type DebugManager } from "./DebugManager";
import { type EventsManager } from "./EventsManager";
import { type State } from "../Game";
import { uniform } from "three/tsl";
import { srgbColorTarget } from "../utils/TweakpaneColor";

const config = {
  LIGHT_POSITION_OFFSET: new Vector3(10, 10, 10),
  // directionalColor: new Color(0.53, 0.65, 0.79), // Dark
  // directionalIntensity: 0.16, // Dark
  directionalColor: new Color(1, 0.79, 0.58).convertSRGBToLinear(), // Light
  directionalIntensity: 0.62, // Light
  // hemiSkyColor: new Color(0.4, 0.45, 0.6), // Dark
  // hemiGroundColor: new Color(0.3, 0.2, 0.2), // Dark
  hemiSkyColor: new Color(0.7, 0.59, 0.52).convertSRGBToLinear(), // Light
  hemiGroundColor: new Color(0.36, 0.31, 0.19).convertSRGBToLinear(), // Light
  hemiIntensity: 0.38,
  // fogColor: new Color(0.05, 0.12, 0.24), // Dark
  // fogDensity: 0.009, // Dark
  fogColor: new Color(0.64, 0.6, 0.48).convertSRGBToLinear(), // Light
  fogDensity: 0.0044, // Light
  fogEnabled: true,
};

export class LightingManager {
  private directionalLight: DirectionalLight;
  private hemisphereLight: HemisphereLight;
  private fog: FogExp2;
  private eventsManager: EventsManager;

  sunDirection = config.LIGHT_POSITION_OFFSET.clone().normalize().negate();
  uSunDir = uniform(this.sunDirection);
  uSunColor = uniform(config.directionalColor.clone());
  uSunIntensity = uniform(config.directionalIntensity);
  uSunRadiance = uniform(
    config.directionalColor.clone().multiplyScalar(config.directionalIntensity),
  );
  uHemiSkyColor = uniform(config.hemiSkyColor.clone());
  uHemiGroundColor = uniform(config.hemiGroundColor.clone());
  uHemiIntensity = uniform(config.hemiIntensity);
  uPlayerShadowBrightness = uniform(0.7);
  uBakedShadowBrightness = uniform(0.45);

  constructor(
    sceneManager: SceneManager,
    debugManager: DebugManager,
    eventsManager: EventsManager,
  ) {
    this.eventsManager = eventsManager;
    this.directionalLight = this.setupDirectionalLighting();
    sceneManager.mainScene.add(this.directionalLight);

    this.hemisphereLight = this.setupHemisphereLight();
    sceneManager.mainScene.add(this.hemisphereLight);

    this.fog = this.setupFog();
    sceneManager.mainScene.fog = this.fog;

    eventsManager.on("engine-camera-change", () => {
      sceneManager.mainScene.fog = sceneManager.mainScene.fog ? null : this.fog;
    });

    this.debugLight(debugManager, sceneManager);
  }

  get sunColor() {
    return this.uSunColor.value;
  }

  private syncSunRadiance() {
    this.uSunRadiance.value
      .copy(this.uSunColor.value)
      .multiplyScalar(this.uSunIntensity.value);
  }

  private setupHemisphereLight() {
    const hemiLight = new HemisphereLight();
    hemiLight.color.copy(this.uHemiSkyColor.value);
    hemiLight.groundColor.copy(this.uHemiGroundColor.value);
    hemiLight.intensity = this.uHemiIntensity.value;
    hemiLight.position.copy(config.LIGHT_POSITION_OFFSET);
    return hemiLight;
  }

  private setupDirectionalLighting() {
    const directionalLight = new DirectionalLight();
    directionalLight.intensity = this.uSunIntensity.value;
    directionalLight.color.copy(this.uSunColor.value);
    directionalLight.position.copy(config.LIGHT_POSITION_OFFSET);

    directionalLight.target = new Object3D();

    return directionalLight;
  }

  private setupFog() {
    const fog = new FogExp2(config.fogColor, config.fogDensity);
    return fog;
  }

  private onEngineUpdate = ({ player }: State) => {
    this.directionalLight.position
      .copy(player.position)
      .add(config.LIGHT_POSITION_OFFSET);
    this.sunDirection.copy(config.LIGHT_POSITION_OFFSET).normalize().negate();
  };

  private debugLight(debugManager: DebugManager, sceneManager: SceneManager) {
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
    lightFolder
      .addBinding(srgbColorTarget(this.uSunColor.value), "value", {
        label: "Directional Color",
        view: "color",
        color: { type: "float" },
      })
      .on("change", () => {
        this.directionalLight.color.copy(this.uSunColor.value);
        this.syncSunRadiance();
      });
    lightFolder
      .addBinding(this.uSunIntensity, "value", {
        min: 0,
        max: 5,
        label: "Directional intensity",
      })
      .on("change", ({ value }) => {
        this.directionalLight.intensity = value;
        this.syncSunRadiance();
      });
    lightFolder.addBinding(this.uPlayerShadowBrightness, "value", {
      label: "Player shadow brightness",
      min: 0,
      max: 1,
      step: 0.01,
    });
    lightFolder.addBinding(this.uBakedShadowBrightness, "value", {
      label: "Baked shadow brightness",
      min: 0,
      max: 1,
      step: 0.01,
    });
    lightFolder.addBinding(srgbColorTarget(this.fog.color), "value", {
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
    lightFolder
      .addBinding(config, "fogEnabled", {
        label: "Fog enabled",
      })
      .on("change", ({ value }) => {
        sceneManager.mainScene.fog = value ? this.fog : null;
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

    lightFolder
      .addBinding(srgbColorTarget(this.uHemiSkyColor.value), "value", {
        label: "Hemisphere sky color",
        view: "color",
        color: { type: "float" },
      })
      .on("change", () => {
        this.hemisphereLight.color.copy(this.uHemiSkyColor.value);
      });
    lightFolder
      .addBinding(srgbColorTarget(this.uHemiGroundColor.value), "value", {
        label: "Hemisphere ground color",
        view: "color",
        color: { type: "float" },
      })
      .on("change", () => {
        this.hemisphereLight.groundColor.copy(this.uHemiGroundColor.value);
      });
    lightFolder
      .addBinding(this.uHemiIntensity, "value", {
        min: 0,
        max: 1,
        label: "Hemisphere intensity",
      })
      .on("change", ({ value }) => {
        this.hemisphereLight.intensity = value;
      });
  }

  setTarget(target: Object3D) {
    this.directionalLight.target = target;
    this.eventsManager.on("engine-render-update", this.onEngineUpdate);
  }
}
