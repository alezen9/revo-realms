import {
  Color,
  Mesh,
  MeshBasicNodeMaterial,
  Vector2,
  Vector3,
} from "three/webgpu";
import {
  abs,
  cameraPosition,
  clamp,
  cross,
  cubeTexture,
  dot,
  exp,
  exp2,
  float,
  Fn,
  fract,
  instancedArray,
  log2,
  mix,
  mod,
  normalize,
  positionLocal,
  positionWorld,
  reflect,
  saturate,
  sin,
  smoothstep,
  step,
  texture,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { assetManager } from "../systems/AssetManager";
import { FolderApi } from "tweakpane";
import { debugManager } from "../systems/DebugManager";
import { sceneManager } from "../systems/SceneManager";
import { State } from "../Game";
import { eventsManager } from "../systems/EventsManager";
import { rendererManager } from "../systems/RendererManager";

type UniformType<T> = ReturnType<typeof uniform<T>>;

type WaterUniforms = {
  uTime?: UniformType<number>;
  uWavesSpeed?: UniformType<number>;
  uWavesAmplitude?: UniformType<number>;
  uWavesFrequency?: UniformType<number>;
  uTroughColor?: UniformType<Color>;
  uSurfaceColor?: UniformType<Color>;
  uPeakColor?: UniformType<Color>;
  uPeakThreshold?: UniformType<number>;
  uPeakTransition?: UniformType<number>;
  uTroughThreshold?: UniformType<number>;
  uTroughTransition?: UniformType<number>;
  uFresnelScale?: UniformType<number>;

  uPlayerPosition: UniformType<Vector3>;
  uPlayerDirection: UniformType<Vector2>;
  uDelta: UniformType<Vector2>;

  uRippleStrength?: UniformType<number>;
  uMaxYDiff?: UniformType<number>;
  uMaxDistSq?: UniformType<number>;
};

const defaultUniforms: Required<WaterUniforms> = {
  uTime: uniform(0),
  uWavesSpeed: uniform(0.02),
  uWavesAmplitude: uniform(0.05),
  uWavesFrequency: uniform(2.68),
  uTroughColor: uniform(new Color().setRGB(0.16, 0.16, 0.16)),
  uSurfaceColor: uniform(new Color().setRGB(0.07, 0.08, 0.09)),
  uPeakColor: uniform(new Color().setRGB(0.46, 0.27, 0.18)),
  uPeakThreshold: uniform(0.5),
  uPeakTransition: uniform(0.5),
  uTroughThreshold: uniform(-0.1),
  uTroughTransition: uniform(0.35),
  uFresnelScale: uniform(0.35),

  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uPlayerDirection: uniform(new Vector2(0, 0)),
  uDelta: uniform(new Vector2()),

  uRippleStrength: uniform(100),
  uMaxYDiff: uniform(1),
  uMaxDistSq: uniform(49),
};

const RIPPLES_AREA_SIZE = 100;

export default class WaterMaterial extends MeshBasicNodeMaterial {
  private _uniforms: Required<WaterUniforms>;
  private _buffer1: ReturnType<typeof instancedArray>; // holds: vec4 = (?, ?, ?, ?)

  private debugFolder: FolderApi;
  constructor(uniforms: WaterUniforms) {
    super();
    this._uniforms = { ...defaultUniforms, ...uniforms };
    this._buffer1 = instancedArray(RIPPLES_AREA_SIZE, "vec4");
    this._buffer1.setPBO(true);
    this.createWaterMaterial();

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });

    this.debugFolder = debugManager.panel.addFolder({ title: "🌊 Water" });
    this.debugFolder.expanded = false;

    this.debugWaves();
    this.debugColor();
    this.debugFresnel();
  }

  private computeInit = Fn(() => {})().compute(RIPPLES_AREA_SIZE);

  private computeUpdate = Fn(() => {})().compute(RIPPLES_AREA_SIZE);

  private computeRipples = Fn(() => {
    const posXZ = positionWorld.xz;
    const center = this._uniforms.uPlayerPosition.xz;
    const dir = this._uniforms.uPlayerDirection;
    const playerY = this._uniforms.uPlayerPosition.y;

    const delta = posXZ.sub(center);
    const distSq = dot(delta, delta);

    const rippleTime = this._uniforms.uTime;

    const inRange = step(distSq, this._uniforms.uMaxDistSq); // 1 if inside, 0 if far
    const heightOk = step(
      abs(playerY.sub(positionWorld.y)),
      this._uniforms.uMaxYDiff,
    );

    const wave = sin(distSq.mul(2.0).sub(rippleTime.mul(5.0)));

    const falloff = exp(distSq.negate().mul(0.5)).mul(
      exp(rippleTime.negate().mul(0.5)),
    );

    const dirFactor = dot(delta, dir).mul(0.5).add(0.5); // [−1,1] → [0,1]

    const ripple = smoothstep(
      0.0,
      1.0,
      wave
        .mul(falloff)
        .mul(dirFactor)
        .mul(this._uniforms.uRippleStrength)
        .mul(inRange)
        .mul(heightOk),
    );

    return ripple;
  });

  private computeElevation = Fn(([pos = vec2(0, 0)]) => {
    const timer = this._uniforms.uTime.mul(this._uniforms.uWavesSpeed).mul(0.1);

    const baseUV = mod(pos.mul(this._uniforms.uWavesFrequency).add(timer), 1);

    const noise = texture(assetManager.noiseTexture, fract(baseUV.mul(10)), 2);
    const mixedNoiseIntermediate = mix(noise.r, noise.g, 0.5);
    const mixedNoise = mix(mixedNoiseIntermediate, noise.b, 0.5);

    const elevation = mixedNoise.mul(this._uniforms.uWavesAmplitude).mul(0.001);

    return elevation;
  });

  private computePosition = Fn(([elevation = float(0)]) => {
    const multipliedElevation = elevation.mul(10);
    return vec3(
      positionLocal.x,
      positionLocal.y.add(multipliedElevation),
      positionLocal.z,
    );
  });

  private computeNormal = Fn(([elevation = float(0)]) => {
    const eps = float(0.001);
    const elevX = this.computeElevation(
      vec2(positionLocal.x.sub(eps), positionLocal.z),
    );
    const elevZ = this.computeElevation(
      vec2(positionLocal.x, positionLocal.z.sub(eps)),
    );
    const tangent = normalize(vec3(eps, elevX.sub(elevation), 0.0));
    const bitangent = normalize(vec3(0.0, elevZ.sub(elevation), eps));
    const avoidDivisionByZero = vec3(0.0001);
    return normalize(cross(tangent, bitangent)).add(avoidDivisionByZero);
  });

  private computeFresnel = Fn(
    ([vNormal = varying(vec3(0, 0, 0)), viewDirection = vec3(0, 0, 0)]) => {
      const factor = exp2(
        log2(float(1.0).sub(clamp(dot(viewDirection, vNormal), 0.0, 1.0))),
      );
      const fresnel = this._uniforms.uFresnelScale.mul(factor);
      return fresnel;
    },
  );

  private computeReflectionColor = Fn(
    ([vNormal = varying(vec3(0, 0, 0)), viewDirection = vec3(0, 0, 0)]) => {
      const reflectedDirection = reflect(viewDirection, vNormal);
      return cubeTexture(assetManager.envMapTexture, reflectedDirection);
    },
  );

  private computeColor = Fn(
    ([
      vNormal = varying(vec3(0, 0, 0)),
      vPosition = varying(vec3(0, 0, 0)),
      vWorldPosition = varying(vec3(0, 0, 0)),
    ]) => {
      // Calculate vector from camera to the vertex
      const viewDirection = normalize(vWorldPosition.sub(cameraPosition));

      // Sample environment map to get the reflected color
      const reflectionColor = this.computeReflectionColor(
        vNormal,
        viewDirection,
      );

      // Calculate fresnel effect
      const fresnelFactor = this.computeFresnel(vNormal, viewDirection);

      // Mix between trough and surface colors based on trough transition
      const troughFactor = saturate(
        vPosition.y
          .sub(this._uniforms.uTroughThreshold)
          .div(this._uniforms.uTroughTransition.mul(2)),
      );
      const mixedColor1 = mix(
        this._uniforms.uTroughColor,
        this._uniforms.uSurfaceColor,
        troughFactor,
      );

      // Mix between surface and peak colors based on peak transition
      const peakFactor = saturate(
        vPosition.y
          .sub(this._uniforms.uPeakThreshold)
          .div(this._uniforms.uPeakTransition.mul(2)),
      );
      const mixedColor2 = mix(
        mixedColor1,
        this._uniforms.uPeakColor,
        peakFactor,
      );

      // Mix the final color with the reflection color
      const finalColor = mix(mixedColor2, reflectionColor.rgb, fresnelFactor);
      const ripples = this.computeRipples();
      finalColor.addAssign(vec3(ripples));

      // const distanceXZ = length(vWorldPosition.xz.sub(cameraPosition.xz));
      const distanceXZSquared = dot(
        vWorldPosition.xz.sub(cameraPosition.xz),
        vWorldPosition.xz.sub(cameraPosition.xz),
      );

      const minDist = 10; // Minimum distance (fully transparent at this distance)
      const maxDist = 55; // Maximum distance (fully opaque at this distance)

      const opacity = mix(
        0.1,
        0.75,
        smoothstep(minDist * minDist, maxDist * maxDist, distanceXZSquared),
      );

      return vec4(finalColor, opacity);
    },
  );

  private createWaterMaterial() {
    this.precision = "lowp";
    // Position
    const elevation = this.computeElevation(uv()).mul(1000);
    const position = this.computePosition(elevation);

    // Normal
    const normal = this.computeNormal(elevation);

    // Varyings
    const vPosition = varying(position, "vPosition");
    const vNormal = varying(normal, "vNormal");
    const vWorldPosition = varying(positionWorld, "vWorldPosition");

    // Color
    const waterColor = this.computeColor(vNormal, vPosition, vWorldPosition);

    this.transparent = true;
    this.colorNode = waterColor;
    this.positionNode = position;
  }

  private debugWaves() {
    const wavesFolder = this.debugFolder.addFolder({ title: "Waves" });
    wavesFolder.addBinding(this._uniforms.uWavesAmplitude, "value", {
      min: 0,
      max: 0.1,
      label: "Amplitude",
    });
    wavesFolder.addBinding(this._uniforms.uWavesFrequency, "value", {
      min: 0.1,
      max: 10,
      label: "Frequency",
    });
    wavesFolder.addBinding(this._uniforms.uWavesSpeed, "value", {
      min: 0,
      max: 1,
      label: "Speed",
    });

    wavesFolder.addBinding(this._uniforms.uRippleStrength, "value", {
      min: 0,
      max: 50,
      label: "Ripple strength",
    });
    wavesFolder.addBinding(this._uniforms.uMaxYDiff, "value", {
      min: -10,
      max: 10,
      label: "Y Max diff",
    });
    wavesFolder.addBinding(this._uniforms.uMaxYDiff, "value", {
      min: 0,
      max: 900,
      label: "Max dist",
    });
  }

  private debugColor() {
    const colorFolder = this.debugFolder.addFolder({ title: "Color" });

    colorFolder.addBinding(this._uniforms.uTroughColor, "value", {
      label: "Trough Color",
      view: "color",
      color: { type: "float" },
    });
    colorFolder.addBinding(this._uniforms.uSurfaceColor, "value", {
      label: "Surface Color",
      view: "color",
      color: { type: "float" },
    });
    colorFolder.addBinding(this._uniforms.uPeakColor, "value", {
      label: "Peak Color",
      view: "color",
      color: { type: "float" },
    });
    colorFolder.addBinding(this._uniforms.uPeakThreshold, "value", {
      min: 0,
      max: 0.5,
      label: "Peak Threshold",
    });
    colorFolder.addBinding(this._uniforms.uPeakTransition, "value", {
      min: 0,
      max: 0.5,
      label: "Peak Transition",
    });
    colorFolder.addBinding(this._uniforms.uTroughThreshold, "value", {
      min: -0.5,
      max: 0,
      label: "Trough Threshold",
    });
    colorFolder.addBinding(this._uniforms.uTroughTransition, "value", {
      min: 0,
      max: 0.5,
      label: "Trough Transition",
    });
  }

  private debugFresnel() {
    const fresnelFolder = this.debugFolder.addFolder({ title: "Fresnel" });
    fresnelFolder.addBinding(this._uniforms.uFresnelScale, "value", {
      min: 0,
      max: 1,
      label: "Scale",
    });
  }

  async updateAsync() {
    await rendererManager.renderer.computeAsync(this.computeUpdate);
  }
}

export class Water {
  private uTime = uniform(0);
  private uPlayerDirection = uniform(new Vector2(0, 0));
  private uPlayerPosition = uniform(new Vector3(0, 0, 0));
  private uDelta = uniform(new Vector2(0, 0));

  private currentXZPosition = new Vector2(0, 0);
  private prevXZPosition = new Vector2(0, 0);
  private lastTriggerTime = 0;
  private readonly rippleCooldown = 0.2;
  private readonly minMoveDistSq = 0.01;

  private material!: WaterMaterial;

  constructor() {
    const water = this.createWater();
    sceneManager.scene.add(water);
    eventsManager.on("update", this.updateAsync.bind(this));
  }

  private createWater() {
    // Visual
    const water = assetManager.realmModel.scene.getObjectByName(
      "water",
    ) as Mesh;
    this.material = new WaterMaterial({
      uTime: this.uTime,
      uPlayerPosition: this.uPlayerPosition,
      uPlayerDirection: this.uPlayerDirection,
      uDelta: this.uDelta,
    });
    water.material = this.material;
    return water;
  }

  private maybeTriggerRipple(player: State["player"]) {
    this.prevXZPosition.set(player.position.x, player.position.z);
    const movedDistSq = this.prevXZPosition.distanceToSquared(
      this.currentXZPosition,
    );

    const hasMovedEnough = movedDistSq > this.minMoveDistSq;
    const isRippleCoolingDown =
      this.uTime.value - this.lastTriggerTime <= this.rippleCooldown;

    if (!hasMovedEnough || isRippleCoolingDown) return;

    const dir = this.prevXZPosition
      .clone()
      .sub(this.currentXZPosition)
      .normalize();
    if (!isFinite(dir.x) || !isFinite(dir.y)) return;

    this.uPlayerDirection.value.copy(dir);
    this.uPlayerPosition.value.copy(player.position);
    this.lastTriggerTime = this.uTime.value;
    this.currentXZPosition.copy(this.prevXZPosition);
  }

  private async updateAsync(state: State) {
    const { clock, player } = state;
    this.uTime.value = clock.getElapsedTime();
    const dx = player.position.x - this.prevXZPosition.x;
    const dz = player.position.z - this.prevXZPosition.y;
    this.uDelta.value.set(dx, dz);
    this.maybeTriggerRipple(player);

    await this.material.updateAsync();
  }
}
