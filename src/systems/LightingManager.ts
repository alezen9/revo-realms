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
import { srgbColorTarget } from "../utils/TweakpaneColor";

const config = {
  LIGHT_POSITION_OFFSET: new Vector3(10, 10, 10),
  // directionalColor: new Color(0.53, 0.65, 0.79), // Dark
  // directionalIntensity: 0.16, // Dark
  directionalColor: new Color(1.0, 0.68, 0.42), // Light
  directionalIntensity: 0.65, // Light
  // hemiSkyColor: new Color(0.4, 0.45, 0.6), // Dark
  // hemiGroundColor: new Color(0.3, 0.2, 0.2), // Dark
  hemiSkyColor: new Color(0.75, 0.48, 0.42), // Light
  hemiGroundColor: new Color(0.25, 0.22, 0.12), // Light
  hemiIntensity: 0.35,
  // fogColor: new Color(0.05, 0.12, 0.24), // Dark
  // fogDensity: 0.009, // Dark
  fogColor: new Color().setRGB(0.48, 0.45, 0.22), // Light
  fogDensity: 0.004, // Light
  fogEnabled: true,
};

export class LightingManager {
  private directionalLight: DirectionalLight;
  private hemisphereLight: HemisphereLight;
  private fog: FogExp2;

  sunDirection = config.LIGHT_POSITION_OFFSET.clone().normalize().negate();

  constructor(
    sceneManager: SceneManager,
    debugManager: DebugManager,
    eventsManager: EventsManager,
  ) {
    this.directionalLight = this.setupDirectionalLighting();
    sceneManager.scene.add(this.directionalLight);

    this.hemisphereLight = this.setupHemisphereLight();
    sceneManager.scene.add(this.hemisphereLight);

    this.fog = this.setupFog();
    sceneManager.scene.fog = this.fog;

    eventsManager.on("engine-camera-change", () => {
      sceneManager.scene.fog = sceneManager.scene.fog ? null : this.fog;
    });

    eventsManager.on("engine-render-update-throttle-4x", ({ player }) => {
      this.directionalLight.position
        .copy(player.position)
        .add(config.LIGHT_POSITION_OFFSET);
    });

    this.debugLight(debugManager, sceneManager);
  }

  get sunColor() {
    return this.directionalLight.color;
  }

  private setupHemisphereLight() {
    const hemiLight = new HemisphereLight();
    hemiLight.color.copy(config.hemiSkyColor);
    hemiLight.groundColor.copy(config.hemiGroundColor);
    hemiLight.intensity = config.hemiIntensity;
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

    directionalLight.shadow.normalBias = 0.02;
    directionalLight.shadow.bias = -0.001;

    return directionalLight;
  }

  private setupFog() {
    const fog = new FogExp2(config.fogColor, config.fogDensity);
    return fog;
  }

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
    lightFolder.addBinding(
      srgbColorTarget(this.directionalLight.color),
      "value",
      {
        label: "Directional Color",
        view: "color",
        color: { type: "float" },
      },
    );
    lightFolder.addBinding(this.directionalLight, "intensity", {
      min: 0,
      max: 5,
      label: "Directional intensity",
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
        sceneManager.scene.fog = value ? this.fog : null;
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

    lightFolder.addBinding(
      srgbColorTarget(this.hemisphereLight.color),
      "value",
      {
        label: "Hemisphere sky color",
        view: "color",
        color: { type: "float" },
      },
    );
    lightFolder.addBinding(
      srgbColorTarget(this.hemisphereLight.groundColor),
      "value",
      {
        label: "Hemisphere ground color",
        view: "color",
        color: { type: "float" },
      },
    );
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
