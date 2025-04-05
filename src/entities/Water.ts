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

  uRippleStrength: uniform(0.2),
  uMaxYDiff: uniform(1),
  uMaxDistSq: uniform(9),
};

export default class WaterMaterial extends MeshBasicNodeMaterial {
  private _uniforms: Required<WaterUniforms>;

  private debugFolder: FolderApi;
  constructor(uniforms: WaterUniforms) {
    super();
    this._uniforms = { ...defaultUniforms, ...uniforms };
    this.createWaterMaterial();

    this.debugFolder = debugManager.panel.addFolder({ title: "🌊 Water" });
    this.debugFolder.expanded = false;

    this.debugWaves();
    this.debugColor();
    this.debugFresnel();
  }

  private computeRipples = Fn(() => {
    const posXZ = positionWorld.xz;
    const playerXZ = this._uniforms.uPlayerPosition.xz;
    const playerDir = normalize(this._uniforms.uPlayerDirection);
    const playerY = this._uniforms.uPlayerPosition.y;

    const delta = posXZ.sub(playerXZ);
    const distSq = dot(delta, delta);

    const inRange = step(distSq, this._uniforms.uMaxDistSq);
    const yDiff = abs(playerY.sub(positionWorld.y));
    const heightOk = smoothstep(
      this._uniforms.uMaxYDiff.add(0.5),
      this._uniforms.uMaxYDiff.negate().add(0.5),
      yDiff,
    );

    const rings = 3.0;
    const phase = this._uniforms.uTime.sub(distSq.mul(0.5));
    const wave = sin(phase.mul(rings)).mul(exp(distSq.negate().mul(0.25)));

    const directionFactor = dot(normalize(delta), playerDir).mul(0.5).add(0.5);
    const forwardArc = smoothstep(0.05, 0.95, directionFactor);

    const ripple = wave
      .mul(forwardArc)
      .mul(this._uniforms.uRippleStrength)
      .mul(inRange)
      .mul(heightOk);

    return vec3(ripple);
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
      const ripples = this.computeRipples();
      const finalColor = mix(
        mixedColor2,
        reflectionColor.rgb,
        fresnelFactor,
      ).add(ripples);

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
    wavesFolder.addBinding(this._uniforms.uMaxDistSq, "value", {
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
}

export class Water {
  private uTime = uniform(0);
  private playerDir = new Vector2(0, 0);
  private uPlayerDirection = uniform(new Vector2(0, 0));
  private uPlayerPosition = uniform(new Vector3(0, 0, 0));

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
    });
    water.material = this.material;
    return water;
  }

  private async updateAsync(state: State) {
    const { clock, player } = state;
    this.uTime.value = clock.getElapsedTime();

    // Ripples
    const dx = player.position.x - this.uPlayerPosition.value.x;
    const dz = player.position.z - this.uPlayerPosition.value.z;
    this.playerDir.set(dx, dz);
    this.uPlayerDirection.value.lerp(this.playerDir, 0.5).normalize();
    this.uPlayerPosition.value.copy(player.position);
  }
}
