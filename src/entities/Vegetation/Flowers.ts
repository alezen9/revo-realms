import {
  cos,
  float,
  floor,
  Fn,
  hash,
  If,
  INFINITY,
  instancedArray,
  instanceIndex,
  mix,
  sin,
  smoothstep,
  step,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  Color,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  SpriteNodeMaterial,
  Vector2,
  Vector3,
} from "three/webgpu";
import type { Node } from "three/webgpu";
import {
  assetManager,
  rendererManager,
  sceneManager,
  eventsManager,
  windManager,
  debugManager,
} from "../../systems";
import { VegetationSsboUtils } from "./ssboUtils";
import { gameTime } from "../../utils/GameTime";
import { TSLUtils } from "../../utils/TSLUtils";

const getConfig = () => {
  const FLOWER_WIDTH = 0.5;
  const FLOWER_HEIGHT = 1;
  const TILE_SIZE = 150;
  const FLOWERS_PER_SIDE = 128;
  const MIN_SCALE = 0.05;
  const MAX_SCALE = 0.15;
  return {
    MIN_SCALE,
    MAX_SCALE,
    FLOWER_WIDTH,
    FLOWER_HEIGHT,
    FLOWER_BOUNDING_SPHERE_RADIUS: FLOWER_HEIGHT,
    TILE_SIZE,
    TILE_HALF_SIZE: TILE_SIZE / 2,
    FLOWERS_PER_SIDE,
    COUNT: FLOWERS_PER_SIDE * FLOWERS_PER_SIDE,
    SPACING: TILE_SIZE / FLOWERS_PER_SIDE,
    WORKGROUP_SIZE: 64,
  };
};
const config = getConfig();

const uniforms = {
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uCameraForward: uniform(new Vector3(0, 0, 0)),
  // culling
  uCameraMatrix: uniform(new Matrix4()), // MVP = Projection * View
  uFx: uniform(1.0),
  uFy: uniform(1.0),
  uCullPadNDCX: uniform(0.075), // small padding to hide rotation lag
  uCullPadNDCYNear: uniform(0.75), // small padding to avoid near clipping
  uCullPadNDCYFar: uniform(0.2), // small padding to avoid far clipping
  // tint
  uColor1: uniform(new Color().setRGB(0.02, 0.14, 0.33)),
  uColor2: uniform(new Color().setRGB(0.99, 0.64, 0.0)),
  uBrightness: uniform(1),
  // wind
  uWindAmbientStrength: uniform(0.5),
  uWindDirectionalStrength: uniform(0.45),
  uWindSwaySpeed: uniform(0.9),
  uWindVerticalBobStrength: uniform(0.1),
};

class FlowersSsbo {
  // x -> offsetX (0 unused)
  // y -> offsetZ (0 unused)
  // z -> 0/12 offsetY - 12/1 visibility - 13/6 grass scale (5 unused)
  // w -> noise (0 unused - also not used currently)
  private buffer = instancedArray(config.COUNT, "vec4");

  constructor() {
    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
  }

  get computeBuffer() {
    return this.buffer;
  }

  getYOffset = Fn<[data: Node<"vec4">], Node<"float">>(([data]) => {
    return TSLUtils.unpackUnits(
      data.z,
      0,
      12,
      0,
      Math.ceil(assetManager.resources.heightmap.userData.max),
    );
  });

  getVisibility = Fn<[data: Node<"vec4">], Node<"float">>(([data]) => {
    return TSLUtils.unpackFlag(data.z, 12);
  });

  getGrassScale = Fn<[data: Node<"vec4">], Node<"float">>(([data]) => {
    return TSLUtils.unpackUnit(data.z, 13, 6);
  });

  getNoise = Fn<[data: Node<"vec4">], Node<"vec4">>(([data]) => {
    const x = TSLUtils.unpackUnit(data.w, 0, 6);
    const y = TSLUtils.unpackUnit(data.w, 6, 6);
    const z = TSLUtils.unpackUnit(data.w, 12, 6);
    const w = TSLUtils.unpackUnit(data.w, 18, 6);
    return vec4(x, y, z, w);
  });

  private setYOffset = Fn<
    [data: Node<"vec4">, value: Node<"float">],
    Node<"vec4">
  >(([data, value]) => {
    data.z = TSLUtils.packUnits(
      data.z,
      0,
      12,
      value,
      0,
      Math.ceil(assetManager.resources.heightmap.userData.max),
    );
    return data;
  });

  private setVisibility = Fn<
    [data: Node<"vec4">, value: Node<"float">],
    Node<"vec4">
  >(([data, value]) => {
    data.z = TSLUtils.packFlag(data.z, 12, value);
    return data;
  });

  private setGrassScale = Fn<
    [data: Node<"vec4">, value: Node<"float">],
    Node<"vec4">
  >(([data, value]) => {
    data.z = TSLUtils.packUnit(data.z, 13, 6, value);
    return data;
  });

  private setNoise = Fn<
    [data: Node<"vec4">, value: Node<"vec4">],
    Node<"vec4">
  >(([data, value]) => {
    data.w = TSLUtils.packUnit(data.w, 0, 6, value.x);
    data.w = TSLUtils.packUnit(data.w, 6, 6, value.y);
    data.w = TSLUtils.packUnit(data.w, 12, 6, value.z);
    data.w = TSLUtils.packUnit(data.w, 18, 6, value.a);
    return data;
  });

  private computeInit = Fn(() => {
    const data = this.buffer.element(instanceIndex);

    // Position XZ
    const row = floor(float(instanceIndex).div(config.FLOWERS_PER_SIDE));
    const col = float(instanceIndex).mod(config.FLOWERS_PER_SIDE);

    const randX = hash(instanceIndex.add(4321));
    const randZ = hash(instanceIndex.add(1234));
    const offsetX = col
      .mul(config.SPACING)
      .sub(config.TILE_HALF_SIZE)
      .add(randX.mul(config.SPACING * 0.5));
    const offsetZ = row
      .mul(config.SPACING)
      .sub(config.TILE_HALF_SIZE)
      .add(randZ.mul(config.SPACING * 0.5));

    const _uv = vec3(offsetX, 0, offsetZ)
      .xz.add(config.TILE_HALF_SIZE)
      .div(config.TILE_SIZE)
      .abs();

    const noise = texture(assetManager.resources.noiseAtlas, _uv);
    data.assign(this.setNoise(data, noise));
    const wrapNoise = noise.r;

    const noiseX = wrapNoise.mul(99.37);
    const noiseZ = wrapNoise.mul(49.71);

    data.x = offsetX.add(noiseX);
    data.y = offsetZ.add(noiseZ);
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);

  computeUpdate = Fn(() => {
    const data = this.buffer.element(instanceIndex);
    // Position
    const pos = VegetationSsboUtils.wrapPosition(
      vec2(data.x, data.y),
      uniforms.uPlayerDeltaXZ,
      config.TILE_SIZE,
    );

    data.x = pos.x;
    data.y = pos.z;

    const worldPos = pos.add(uniforms.uPlayerPosition);
    const clipPosition = VegetationSsboUtils.computeClipPosition(
      worldPos,
      uniforms.uCameraMatrix,
    );

    // Visibility
    const isVisible = VegetationSsboUtils.computeVisibilityFromClip(
      clipPosition,
      uniforms.uFx,
      uniforms.uFy,
      config.FLOWER_BOUNDING_SPHERE_RADIUS,
      uniforms.uCullPadNDCX,
      uniforms.uCullPadNDCYNear,
      uniforms.uCullPadNDCYFar,
    );

    data.assign(this.setVisibility(data, isVisible));

    If(isVisible, () => {
      // Y offset
      const yOffset = VegetationSsboUtils.computeYOffset(worldPos);
      data.assign(this.setYOffset(data, yOffset));

      // Grass scale
      const grassScale = VegetationSsboUtils.computeGrassScale(worldPos);
      const grassVisibility = step(0.05, grassScale);
      data.assign(this.setGrassScale(data, grassScale));
      data.assign(this.setVisibility(data, grassVisibility));
    });
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);
}

export default class Flowers {
  private isComputeInFlight = false;

  constructor() {
    const ssbo = new FlowersSsbo();
    const material = new FlowerMaterial(ssbo);
    const flowers = new InstancedMesh(
      new PlaneGeometry(1, 1),
      material,
      config.COUNT,
    );
    sceneManager.scene.add(flowers);

    this.debug();

    eventsManager.on("engine-update-throttle-16x", ({ player }) => {
      const dx = player.position.x - flowers.position.x;
      const dz = player.position.z - flowers.position.z;
      uniforms.uPlayerDeltaXZ.value.set(dx, dz);
      uniforms.uPlayerPosition.value.copy(player.position);
      const proj = sceneManager.playerCamera.projectionMatrix;
      uniforms.uFx.value = proj.elements[0];
      uniforms.uFy.value = proj.elements[5];
      uniforms.uCameraMatrix.value
        .copy(proj)
        .multiply(sceneManager.playerCamera.matrixWorldInverse);
      sceneManager.playerCamera.getWorldDirection(
        uniforms.uCameraForward.value,
      );
      flowers.position.copy(player.position).setY(0);
      if (this.isComputeInFlight) return;
      this.isComputeInFlight = true;
      rendererManager.renderer
        .computeAsync(ssbo.computeUpdate)
        .catch((error) => {
          console.error("[Flowers] computeAsync failed:", error);
        })
        .finally(() => {
          this.isComputeInFlight = false;
        });
    });
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🌸 Flowers",
      expanded: false,
    });

    folder.addBinding(uniforms.uColor1, "value", {
      label: "Color 1",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.uColor2, "value", {
      label: "Color 2",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.uBrightness, "value", {
      label: "Brightness",
      min: 0,
      max: 3,
      step: 0.01,
    });
    folder.addBinding(uniforms.uWindAmbientStrength, "value", {
      label: "Wind ambient",
      min: 0,
      max: 0.5,
      step: 0.01,
    });
    folder.addBinding(uniforms.uWindDirectionalStrength, "value", {
      label: "Wind directional",
      min: 0,
      max: 1,
      step: 0.01,
    });
    folder.addBinding(uniforms.uWindSwaySpeed, "value", {
      label: "Wind speed",
      min: 0,
      max: 3,
      step: 0.01,
    });
    folder.addBinding(uniforms.uWindVerticalBobStrength, "value", {
      label: "Wind vertical bob",
      min: 0,
      max: 0.2,
      step: 0.005,
    });
  }
}

class FlowerMaterial extends SpriteNodeMaterial {
  private ssbo: FlowersSsbo;
  constructor(ssbo: FlowersSsbo) {
    super();

    this.ssbo = ssbo;
    this.createFlowersMaterial();
  }

  private createFlowersMaterial() {
    this.precision = "lowp";
    this.stencilWrite = false;
    this.forceSinglePass = true;
    this.transparent = false;

    const data = this.ssbo.computeBuffer.element(instanceIndex);
    const isVisible = this.ssbo.getVisibility(data);
    const grassScale = this.ssbo.getGrassScale(data);
    const noise = this.ssbo.getNoise(data);
    const x = data.x;
    const y = this.ssbo.getYOffset(data);
    const z = data.y;

    const rand1 = hash(instanceIndex.add(9234));
    const rand2 = hash(instanceIndex.add(33.87));
    const rand3 = hash(float(instanceIndex).add(noise.r.mul(97.13)));

    // Position
    const windIntensity = windManager.uIntensity;
    const windDirection = windManager.uDirection;
    const windEvent = windIntensity.sub(0.1).div(0.9).clamp();
    const timer = gameTime.mul(uniforms.uWindSwaySpeed);
    const windTravel = x.mul(windDirection.x).add(z.mul(windDirection.y));
    const travelWave = sin(
      windTravel.mul(0.16).sub(timer.mul(2.2)).add(rand3.mul(6.28318)),
    )
      .mul(0.5)
      .add(0.5);
    const directionalWave = smoothstep(0.28, 0.88, travelWave);
    const responseVariation = mix(0.55, 1.15, noise.g).mul(
      mix(0.72, 1.05, rand1),
    );
    const ambientPhase = timer.add(rand1.mul(100)).add(noise.b.mul(12.0));
    const ambientSway = uniforms.uWindAmbientStrength
      .mul(mix(0.45, 1.0, noise.a))
      .mul(grassScale);
    const directionalSway = uniforms.uWindDirectionalStrength
      .mul(windEvent)
      .mul(directionalWave)
      .mul(responseVariation)
      .mul(grassScale);
    const sideDirection = vec2(windDirection.y.negate(), windDirection.x);
    const sideSway = sin(ambientPhase.mul(1.35))
      .mul(ambientSway)
      .mul(mix(0.12, 0.42, rand2));
    const windLean = windDirection.mul(directionalSway);
    const ambientLean = windDirection
      .mul(sin(ambientPhase).mul(ambientSway))
      .add(sideDirection.mul(sideSway));
    const swayX = ambientLean.x.add(windLean.x);
    const swayY = rand2
      .mul(0.28)
      .add(
        sin(ambientPhase.mul(1.7).add(rand3.mul(6.28318))).mul(
          uniforms.uWindVerticalBobStrength.mul(grassScale),
        ),
      );
    const swayZ = ambientLean.y.add(windLean.y);
    const swayOffset = vec3(swayX, swayY, swayZ);
    const offscreenOffset = uniforms.uCameraForward
      .mul(INFINITY)
      .mul(float(1).sub(isVisible));
    const baseHeight = rand1.add(rand2).add(0.25).clamp().mul(grassScale);
    const offsetY = y.add(baseHeight);
    const basePosition = vec3(x, offsetY, z);
    this.positionNode = basePosition.add(swayOffset).add(offscreenOffset);

    // Size
    this.scaleNode = vec3(
      rand1.remap(0, 1, config.MIN_SCALE, config.MAX_SCALE),
    ).mul(grassScale.remap(0, 1, 0.6, 1));

    // Diffuse
    const flower = texture(assetManager.resources.edelweiss, uv());
    const tint = mix(uniforms.uColor1, uniforms.uColor2, rand2);
    this.colorNode = tint.mul(flower.rgb).mul(uniforms.uBrightness);

    // Opacity
    this.opacityNode = isVisible.mul(flower.a);
    this.alphaTest = 0.15;
  }
}
