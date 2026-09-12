import { Color, type Object3D, Vector3 } from "three";
import { type Node, type WebGPURenderer } from "three/webgpu";
import { float, Fn, mix, uniform, vec3 } from "three/tsl";
import { srgbColorTarget } from "../../utils/TweakpaneColor";
import type { AssetManager } from "../AssetManager/AssetManager";
import type { DebugManager } from "../DebugManager";
import type { EventsManager } from "../EventsManager";
import type { LightingManager } from "../LightingManager";
import { GroundShadowCache } from "./GroundShadowCache";
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
  private hasDirtyLocalMap = true;
  private hasPendingGlobalBake = true;
  private hasPendingLocalBake = true;
  private isGlobalProjection = true;
  private localCenterX = Number.NaN;
  private localCenterZ = Number.NaN;

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
    this.hasDirtyLocalMap = true;
    this.hasPendingGlobalBake = true;
    this.hasPendingLocalBake = true;
    this.isGlobalProjection = true;
  }

  beforeRender(playerPosition: Vector3) {
    this.updateLocalCenter(playerPosition);
    if (this.registry.haveCastersMoved()) this.invalidate();

    if (this.hasDirtyGlobalMap) {
      this.projection.fitGlobal();
      this.lightingManager.sunLight.shadow.needsUpdate = true;
      this.hasDirtyGlobalMap = false;
      this.hasPendingGlobalBake = true;
      this.isGlobalProjection = true;
      return;
    }

    if (!this.hasDirtyLocalMap) return;
    this.projection.fitLocal(this.localCenterX, this.localCenterZ);
    this.groundCache.setLocalRegion(this.localCenterX, this.localCenterZ);
    this.lightingManager.sunLight.shadow.needsUpdate = true;
    this.hasDirtyLocalMap = false;
    this.hasPendingLocalBake = true;
    this.isGlobalProjection = false;
  }

  afterRender() {
    if (this.isGlobalProjection) {
      if (!this.hasPendingGlobalBake) return;
      if (!this.groundCache.bakeGlobal()) return;
      this.hasPendingGlobalBake = false;
      this.groundCache.markGlobalAvailable();
      return;
    }

    if (!this.hasPendingLocalBake) return;
    if (!this.groundCache.bakeLocal()) return;
    this.hasPendingLocalBake = false;
    this.groundCache.markLocalAvailable();
  }

  bakeGroundAsync() {
    if (!this.isGlobalProjection) {
      this.invalidate();
      return Promise.resolve(false);
    }
    this.registry.syncCasterMatrices();
    return this.groundCache.bakeGlobalAsync().then((hasBaked) => {
      if (!hasBaked) {
        this.invalidate();
        return false;
      }
      this.hasPendingGlobalBake = false;
      this.hasDirtyLocalMap = true;
      this.groundCache.markGlobalAvailable();
      return true;
    });
  }

  invalidate = () => {
    this.hasDirtyGlobalMap = true;
    this.hasDirtyLocalMap = true;
    this.groundCache.invalidateLocal();
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

  private updateLocalCenter(playerPosition: Vector3) {
    const distance = shadowSettings.localRecenterDistance;
    const isInsideCurrentRegion =
      Number.isFinite(this.localCenterX) &&
      Math.abs(playerPosition.x - this.localCenterX) <= distance &&
      Math.abs(playerPosition.z - this.localCenterZ) <= distance;
    if (isInsideCurrentRegion) return;
    this.localCenterX = Math.round(playerPosition.x / distance) * distance;
    this.localCenterZ = Math.round(playerPosition.z / distance) * distance;
    this.hasDirtyLocalMap = true;
  }

  private applyReceiverShadow = (factor?: Node<"float">) => {
    if (!factor) return vec3(1);
    return this.getMultiplier(factor);
  };

  private debug(debugManager: DebugManager) {
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
      .addBinding(shadowSettings, "localSize", {
        label: "Local size",
        min: 32,
        max: 128,
        step: 8,
      })
      .on("change", () => {
        this.hasDirtyLocalMap = true;
      });
    folder
      .addBinding(shadowSettings, "localBlendDistance", {
        label: "Blend distance",
        min: 2,
        max: 24,
        step: 1,
      })
      .on("change", () => {
        this.hasDirtyLocalMap = true;
      });
    folder
      .addBinding(shadowSettings, "localRecenterDistance", {
        label: "Recenter distance",
        min: 2,
        max: 16,
        step: 2,
      })
      .on("change", () => {
        this.localCenterX = Number.NaN;
        this.localCenterZ = Number.NaN;
      });
    folder
      .addBinding(shadowSettings, "refresh", { label: "Refresh now" })
      .on("change", this.invalidate);
  }
}
