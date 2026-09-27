import {
  Color,
  DirectionalLight,
  HemisphereLight,
  Object3D,
  Vector2,
  Vector3,
} from "three";
import { type SceneManager } from "./SceneManager";
import { type DebugManager } from "./DebugManager";
import { type EventsManager } from "./EventsManager";
import type { AssetManager } from "./AssetManager/AssetManager";
import { type State } from "../Game";
import type { Node } from "three/webgpu";
import { exp, float, mix, texture, uniform, vec2 } from "three/tsl";
import { srgbColorTarget } from "../utils/TweakpaneColor";
import { TSLUtils } from "../utils/TSLUtils";
import { gameTime } from "../utils/GameTime";
import { windManager } from ".";

const WISP_SCALE = 0.025;
const WISP_SPEED = 0.8;
const WISP_STRENGTH = 0.85;
const SUN_GLOW_SHARPNESS = 6;
const SUN_GLOW_STRENGTH = 0.5;

const config = {
  LIGHT_POSITION_OFFSET: new Vector3(10, 5, 10),
  // directionalColor: new Color(0.53, 0.65, 0.79), // Dark
  // directionalIntensity: 0.16, // Dark
  directionalColor: new Color(0.96, 0.67, 0.46).convertSRGBToLinear(), // Light
  directionalIntensity: 0.62, // Light
  // hemiSkyColor: new Color(0.4, 0.45, 0.6), // Dark
  // hemiGroundColor: new Color(0.3, 0.2, 0.2), // Dark
  hemiSkyColor: new Color(0.82, 0.64, 0.53).convertSRGBToLinear(), // Light
  hemiGroundColor: new Color(0.36, 0.31, 0.19).convertSRGBToLinear(), // Light
  hemiIntensity: 0.38,
  // fogColor: new Color(0.05, 0.12, 0.24), // Dark
  // fogDensity: 0.009, // Dark
  fogColor: new Color(0.64, 0.6, 0.48).convertSRGBToLinear(), // Light
  fogDensity: 0.0044, // Light
  mistDensity: 0.06,
  mistHeight: 0.6,
  fogEnabled: true,
  backgroundEnabled: false,
};

export class LightingManager {
  private directionalLight: DirectionalLight;
  private hemisphereLight: HemisphereLight;
  private eventsManager: EventsManager;
  private assetManager: AssetManager;

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
  uFogColor = uniform(config.fogColor.clone());
  uFogDensity = uniform(config.fogDensity);
  uMistDensity = uniform(config.mistDensity);
  uMistHeight = uniform(config.mistHeight);
  uFogAmount = uniform(1);

  constructor(
    sceneManager: SceneManager,
    debugManager: DebugManager,
    eventsManager: EventsManager,
    assetManager: AssetManager,
  ) {
    this.assetManager = assetManager;
    this.eventsManager = eventsManager;
    this.directionalLight = this.setupDirectionalLighting();
    sceneManager.mainScene.add(this.directionalLight);

    this.hemisphereLight = this.setupHemisphereLight();
    sceneManager.mainScene.add(this.hemisphereLight);

    this.syncFog(sceneManager);

    eventsManager.on("engine-camera-change", () => this.syncFog(sceneManager));

    this.debugLight(debugManager, sceneManager);
  }

  get sunColor() {
    return this.uSunColor.value;
  }

  getFogVisibility(worldPosition: Node<"vec3">, viewerPosition: Node<"vec3">) {
    const { heightmap, noiseAtlas } = this.assetManager.resources;
    const mapUv = TSLUtils.computeMapUvByPosition(worldPosition.xz);
    const groundHeight = texture(
      heightmap,
      vec2(mapUv.x, float(1).sub(mapUv.y)),
    ).r;
    const pointHeight = worldPosition.y.sub(groundHeight).max(0);
    const viewerHeight = viewerPosition.y.sub(groundHeight).max(0);
    const distance = worldPosition.sub(viewerPosition).length();

    const falloff = float(1).div(this.uMistHeight);
    const viewerMist = exp(falloff.mul(viewerHeight).negate());
    const pointMist = exp(falloff.mul(pointHeight).negate());
    const heightDelta = pointHeight.sub(viewerHeight);
    const isLevelRay = heightDelta.abs().lessThan(0.001);
    const averageMist = isLevelRay.select(
      viewerMist,
      viewerMist.sub(pointMist).div(falloff.mul(heightDelta)),
    );

    const windOffset = windManager.uDirection.mul(gameTime.mul(WISP_SPEED));
    const wispUv = worldPosition.xz.add(windOffset).mul(WISP_SCALE).fract();
    const wispNoise = texture(noiseAtlas, wispUv, 2).rg;
    const wisps = wispNoise.x.mul(0.7).add(wispNoise.y.mul(0.3));
    const mistDensity = this.uMistDensity.mul(
      mix(1 - WISP_STRENGTH, 1 + WISP_STRENGTH, wisps),
    );

    const mistDepth = mistDensity.mul(averageMist).mul(distance);
    const hazeDepth = this.uFogDensity.mul(distance);
    const opticalDepth = mistDepth.add(hazeDepth.mul(hazeDepth));
    return mix(float(1), exp(opticalDepth.negate()), this.uFogAmount);
  }

  getFogColor(worldPosition: Node<"vec3">, viewerPosition: Node<"vec3">) {
    const viewDirection = worldPosition.sub(viewerPosition).normalize();
    const sunGlow = viewDirection
      .dot(this.uSunDir.negate())
      .max(0)
      .pow(SUN_GLOW_SHARPNESS)
      .mul(SUN_GLOW_STRENGTH);
    return mix(this.uFogColor, this.uSunColor, sunGlow);
  }

  private syncFog(sceneManager: SceneManager) {
    const isPlayerCamera =
      sceneManager.renderCamera === sceneManager.playerCamera;
    const isFogVisible = config.fogEnabled && isPlayerCamera;
    this.uFogAmount.value = Number(isFogVisible);
  }

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

  private debugLight(debugManager: DebugManager, sceneManager: SceneManager) {
    const lightFolder = debugManager.panel.addFolder({
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
    lightFolder.addBinding(srgbColorTarget(this.uFogColor.value), "value", {
      label: "Fog Color",
      view: "color",
      color: { type: "float" },
    });
    lightFolder.addBinding(this.uFogDensity, "value", {
      label: "Fog Density",
      min: 0,
      max: 0.025,
      step: 0.0001,
    });
    lightFolder.addBinding(this.uMistDensity, "value", {
      label: "Mist density",
      min: 0,
      max: 0.5,
      step: 0.005,
    });
    lightFolder.addBinding(this.uMistHeight, "value", {
      label: "Mist height",
      min: 0.1,
      max: 5,
      step: 0.05,
    });
    lightFolder
      .addBinding(config, "fogEnabled", {
        label: "Fog enabled",
      })
      .on("change", () => this.syncFog(sceneManager));
    lightFolder
      .addBinding(config, "backgroundEnabled", {
        label: "Background enabled",
      })
      .on("change", ({ value }) => {
        sceneManager.mainScene.background = value
          ? this.assetManager.resources.envMapTexture
          : null;
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
