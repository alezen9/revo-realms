import {
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Object3D,
  Vector2,
  Vector3,
} from "three";
import { type Stage } from "../scene/Stage";
import { type DebugPanel } from "../debug/DebugPanel";
import { type EventBus } from "../events/EventBus";
import type { Assets } from "../assets/Assets";
import { type State } from "../../Game";
import { uniform } from "three/tsl";
import { srgbColorTarget } from "../debug/tweakpaneColor";

const config = {
  LIGHT_POSITION_OFFSET: new Vector3(10, 5, 10),
  directionalColor: new Color(0.96, 0.67, 0.46).convertSRGBToLinear(),
  directionalIntensity: 0.62,
  hemiSkyColor: new Color(0.82, 0.64, 0.53).convertSRGBToLinear(),
  hemiGroundColor: new Color(0.36, 0.31, 0.19).convertSRGBToLinear(),
  hemiIntensity: 0.38,
  fogColor: new Color(0.64, 0.6, 0.48).convertSRGBToLinear(),
  fogDensity: 0.0044,
  fogEnabled: true,
  backgroundEnabled: false,
};

export class Lighting {
  private directionalLight: DirectionalLight;
  private hemisphereLight: HemisphereLight;
  private fog: FogExp2;
  private eventBus: EventBus;
  private assets: Assets;
  private stage: Stage;

  sunDirection = config.LIGHT_POSITION_OFFSET.clone().normalize().negate();
  sunDirectionXZ = new Vector2(
    this.sunDirection.x,
    this.sunDirection.z,
  ).normalize();
  uSunDir = uniform(this.sunDirection);
  uSunDirXZ = uniform(this.sunDirectionXZ);
  uSunColor = uniform(config.directionalColor.clone());
  uSunIntensity = uniform(config.directionalIntensity);
  uSunRadiance = uniform(
    config.directionalColor.clone().multiplyScalar(config.directionalIntensity),
  );
  uHemiSkyColor = uniform(config.hemiSkyColor.clone());
  uHemiGroundColor = uniform(config.hemiGroundColor.clone());
  uHemiIntensity = uniform(config.hemiIntensity);

  constructor(
    stage: Stage,
    debugPanel: DebugPanel,
    eventBus: EventBus,
    assets: Assets,
  ) {
    this.assets = assets;
    this.eventBus = eventBus;
    this.stage = stage;
    this.directionalLight = this.setupDirectionalLighting();
    stage.mainScene.add(this.directionalLight);

    this.hemisphereLight = this.setupHemisphereLight();
    stage.mainScene.add(this.hemisphereLight);

    this.fog = new FogExp2(config.fogColor, config.fogDensity);
    this.syncFog();

    eventBus.on("engine-camera-change", this.syncFog);

    this.debugLight(debugPanel);
  }

  get sunColor() {
    return this.uSunColor.value;
  }

  private syncFog = () => {
    const { stage } = this;
    const isPlayerCamera = stage.renderCamera === stage.playerCamera;
    const isFogVisible = config.fogEnabled && isPlayerCamera;
    stage.mainScene.fog = null;
    if (isFogVisible) stage.mainScene.fog = this.fog;
  };

  private syncBackground = () => {
    const { mainScene } = this.stage;
    mainScene.background = null;
    if (config.backgroundEnabled)
      mainScene.background = this.assets.resources.envMapTexture;
  };

  private syncSunDirection() {
    this.sunDirection.copy(config.LIGHT_POSITION_OFFSET).normalize().negate();
    this.sunDirectionXZ
      .set(this.sunDirection.x, this.sunDirection.z)
      .normalize();
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

  private onEngineUpdate = ({ player }: State) => {
    this.directionalLight.position
      .copy(player.position)
      .add(config.LIGHT_POSITION_OFFSET);
  };

  private debugLight(debugPanel: DebugPanel) {
    const lightFolder = debugPanel.panel.addFolder({
      title: "💡 Light",
      expanded: false,
    });
    lightFolder
      .addBinding(config.LIGHT_POSITION_OFFSET, "x", {
        label: "Sun position X",
      })
      .on("change", () => this.syncSunDirection());
    lightFolder
      .addBinding(config.LIGHT_POSITION_OFFSET, "z", {
        label: "Sun position Z",
      })
      .on("change", () => this.syncSunDirection());
    lightFolder
      .addBinding(config.LIGHT_POSITION_OFFSET, "y", {
        label: "Sun height",
      })
      .on("change", () => this.syncSunDirection());
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
      .on("change", this.syncFog);
    lightFolder
      .addBinding(config, "backgroundEnabled", {
        label: "Background enabled",
      })
      .on("change", this.syncBackground);

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
    this.eventBus.on("engine-render-update", this.onEngineUpdate);
  }
}
