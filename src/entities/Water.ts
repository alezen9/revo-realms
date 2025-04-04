import { Color, Mesh, MeshBasicNodeMaterial } from "three/webgpu";
import {
  cameraPosition,
  clamp,
  cross,
  cubeTexture,
  dot,
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
  smoothstep,
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

  constructor() {
    const water = this.createWater();
    sceneManager.scene.add(water);
    eventsManager.on("update", this.update.bind(this));
  }

  private createWater() {
    // Visual
    const water = assetManager.realmModel.scene.getObjectByName(
      "water",
    ) as Mesh;
    const waterMaterial = new WaterMaterial({
      uTime: this.uTime,
    });
    water.material = waterMaterial;
    return water;
  }

  private update(state: State) {
    const { clock } = state;
    this.uTime.value = clock.getElapsedTime();
  }
}
