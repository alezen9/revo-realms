import { Color, type Object3D, Vector3 } from "three";
import { type Node, type WebGPURenderer } from "three/webgpu";
import { float, Fn, mix, uniform, vec3 } from "three/tsl";
import { srgbColorTarget } from "../../utils/TweakpaneColor";
import type { AssetManager } from "../AssetManager/AssetManager";
import type { DebugManager } from "../DebugManager";
import type { EventsManager } from "../EventsManager";
import type { LightingManager } from "../LightingManager";
import { GroundShadowCache } from "./GroundShadowCache";
import type { GroundShadowLevel } from "./GroundShadowLevel";
import { ShadowCasterRegistry } from "./ShadowCasterRegistry";
import { ShadowProjection } from "./ShadowProjection";
import {
  STATIC_SHADOW_LAYER,
  type ShadowRegistration,
  shadowSettings,
} from "./ShadowSettings";

export class ShadowManager {
  readonly uStrength = uniform(0.6);
  readonly uTint = uniform(new Color(0.46, 0.52, 0.64).convertSRGBToLinear());
  readonly uGroundGeneration: GroundShadowCache["uGeneration"];
  readonly getGroundFactor: GroundShadowCache["getGroundFactor"];
  private groundCache: GroundShadowCache;
  private lightingManager: LightingManager;
  private projection: ShadowProjection;
  private registry: ShadowCasterRegistry;
  private hasDirtyGlobalMap = true;
  private dirtyLevels = new Set<GroundShadowLevel>();
  private pendingBake: "global" | GroundShadowLevel | undefined = "global";

  constructor(
    renderer: WebGPURenderer,
    lightingManager: LightingManager,
    assetManager: AssetManager,
    eventsManager: EventsManager,
    debugManager: DebugManager,
  ) {
    this.lightingManager = lightingManager;
    this.groundCache = new GroundShadowCache(
      renderer,
      lightingManager,
      assetManager,
    );
    for (const level of this.groundCache.levels) this.dirtyLevels.add(level);
    this.uGroundGeneration = this.groundCache.uGeneration;
    this.getGroundFactor = this.groundCache.getGroundFactor;
    this.registry = new ShadowCasterRegistry(this.applyReceiverShadow);
    this.projection = new ShadowProjection(
      assetManager,
      lightingManager,
      this.registry,
    );
    this.configureLight();
    this.debug(debugManager);
    eventsManager.on("engine-sun-change", this.invalidate);
  }

  getMultiplier = Fn<[factor: Node<"float">], Node<"vec3">>(([factor]) => {
    const amount = float(1).sub(factor).mul(this.uStrength);
    return mix(vec3(1), this.uTint, amount);
  });

  register(object: Object3D, registration: ShadowRegistration) {
    if (this.registry.register(object, registration)) this.invalidate();
  }

  prepareBake() {
    this.projection.fitGlobal();
    this.registry.syncCasterMatrices();
    this.lightingManager.sunLight.shadow.needsUpdate = true;
    this.hasDirtyGlobalMap = false;
    for (const level of this.groundCache.levels) this.dirtyLevels.add(level);
    this.pendingBake = "global";
  }

  beforeRender(playerPosition: Vector3, delta: number) {
    this.groundCache.update(delta);
    this.updateLevelCenters(playerPosition);
    if (this.registry.haveCastersMoved()) this.invalidate();

    if (this.hasDirtyGlobalMap) {
      this.projection.fitGlobal();
      this.lightingManager.sunLight.shadow.needsUpdate = true;
      this.hasDirtyGlobalMap = false;
      this.pendingBake = "global";
      return;
    }

    if (this.pendingBake) return;
    const level = this.getNextDirtyLevel();
    if (!level) return;
    const { size } = level.settings;
    this.projection.fitRegion(level.centerX, level.centerZ, size);
    this.groundCache.prepareLevel(level);
    this.lightingManager.sunLight.shadow.needsUpdate = true;
    this.dirtyLevels.delete(level);
    this.pendingBake = level;
  }

  afterRender() {
    if (this.pendingBake === "global") {
      if (!this.groundCache.bakeGlobal()) return;
      this.groundCache.markGlobalAvailable();
      this.pendingBake = undefined;
      return;
    }

    if (!this.pendingBake) return;
    if (!this.groundCache.bakeLevel(this.pendingBake)) return;
    this.groundCache.markLevelAvailable(this.pendingBake);
    this.pendingBake = undefined;
  }

  bakeGroundAsync() {
    if (this.pendingBake !== "global") {
      this.invalidate();
      return Promise.resolve(false);
    }
    this.registry.syncCasterMatrices();
    return this.groundCache.bakeGlobalAsync().then((hasBaked) => {
      if (!hasBaked) {
        this.invalidate();
        return false;
      }
      this.pendingBake = undefined;
      this.groundCache.markGlobalAvailable();
      return true;
    });
  }

  invalidate = () => {
    this.hasDirtyGlobalMap = true;
    for (const level of this.groundCache.levels) this.dirtyLevels.add(level);
    this.groundCache.invalidateLevels();
  };

  private configureLight() {
    const { sunLight } = this.lightingManager;
    const { shadow } = sunLight;
    sunLight.castShadow = true;
    shadow.mapSize.setScalar(shadowSettings.resolution);
    shadow.bias = shadowSettings.bias;
    shadow.normalBias = shadowSettings.normalBias;
    shadow.radius = shadowSettings.softness;
    shadow.blurSamples = shadowSettings.blurSamples;
    shadow.intensity = 1;
    shadow.autoUpdate = false;
    shadow.needsUpdate = true;
    shadow.camera.layers.set(STATIC_SHADOW_LAYER);
  }

  private updateLevelCenters(playerPosition: Vector3) {
    for (const level of this.groundCache.levels) {
      if (!level.updateCenter(playerPosition.x, playerPosition.z)) continue;
      this.dirtyLevels.add(level);
    }
  }

  private getNextDirtyLevel() {
    const { levels } = this.groundCache;
    for (let index = levels.length - 1; index >= 0; index--) {
      const level = levels[index];
      if (this.dirtyLevels.has(level)) return level;
    }
  }

  private applyReceiverShadow = (factor?: Node<"float">) => {
    if (!factor) return vec3(1);
    return this.getMultiplier(factor);
  };

  private debug(debugManager: DebugManager) {
    const nearLevel = this.groundCache.levels[0];
    const nearSettings = nearLevel.settings;
    const folder = debugManager.panel.addFolder({
      title: "🌘 Shadows",
      expanded: false,
    });
    folder.addBinding(this.uStrength, "value", {
      label: "Strength",
      min: 0,
      max: 1,
      step: 0.01,
    });
    folder.addBinding(srgbColorTarget(this.uTint.value), "value", {
      label: "Tint",
      view: "color",
      color: { type: "float" },
    });
    folder
      .addBinding(shadowSettings, "resolution", {
        label: "Resolution",
        options: { "1024": 1024, "2048": 2048, "4096": 4096 },
      })
      .on("change", ({ value }) => {
        this.lightingManager.sunLight.shadow.mapSize.setScalar(value);
        this.groundCache.resetComputes();
        this.invalidate();
      });
    folder
      .addBinding(shadowSettings, "softness", {
        label: "Softness",
        min: 0,
        max: 5,
        step: 0.1,
      })
      .on("change", ({ value }) => {
        this.lightingManager.sunLight.shadow.radius = value;
        this.invalidate();
      });
    folder
      .addBinding(shadowSettings, "bias", {
        label: "Depth bias",
        min: -0.002,
        max: 0.002,
        step: 0.00001,
      })
      .on("change", ({ value }) => {
        this.lightingManager.sunLight.shadow.bias = value;
        this.groundCache.setBias(value);
        this.invalidate();
      });
    folder
      .addBinding(shadowSettings, "normalBias", {
        label: "Normal bias",
        min: 0,
        max: 0.25,
        step: 0.005,
      })
      .on("change", ({ value }) => {
        this.lightingManager.sunLight.shadow.normalBias = value;
        this.invalidate();
      });
    folder
      .addBinding(nearSettings, "size", {
        label: "Near size",
        min: 32,
        max: 128,
        step: 8,
      })
      .on("change", () => {
        this.dirtyLevels.add(nearLevel);
      });
    folder
      .addBinding(nearSettings, "blendDistance", {
        label: "Near blend",
        min: 2,
        max: 24,
        step: 1,
      })
      .on("change", () => {
        this.dirtyLevels.add(nearLevel);
      });
    folder
      .addBinding(nearSettings, "recenterDistance", {
        label: "Near recenter",
        min: 2,
        max: 16,
        step: 2,
      })
      .on("change", () => {
        nearLevel.centerX = Number.NaN;
        nearLevel.centerZ = Number.NaN;
      });
    folder.addBinding(nearSettings, "transitionDuration", {
      label: "Transition time",
      min: 0,
      max: 1,
      step: 0.025,
    });
    folder
      .addBinding(shadowSettings, "refresh", { label: "Refresh now" })
      .on("change", this.invalidate);
  }
}
