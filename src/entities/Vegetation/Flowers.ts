import {
  float,
  floor,
  Fn,
  hash,
  If,
  INFINITY,
  instancedArray,
  instanceIndex,
  mix,
  mod,
  PI2,
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
import { type State } from "../../Game";
import { gameTime } from "../../utils/GameTime";
import { TSLUtils } from "../../utils/TSLUtils";
import { srgbColorTarget } from "../../utils/TweakpaneColor";

const getConfig = () => {
  const FLOWER_WIDTH = 0.5;
  const FLOWER_HEIGHT = 1;
  const TILE_SIZE = 150;
  const FLOWERS_PER_SIDE = 64;
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 0.2;
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
  uColor1: uniform(new Color(0.54, 0.54, 0.54).convertSRGBToLinear()),
  uColor2: uniform(new Color(0.99, 0.48, 0.0).convertSRGBToLinear()),
  uBrightness: uniform(1),
  // wind
  uWindAmbientStrength: uniform(0.2),
  uWindDirectionalStrength: uniform(0.45),
  uWindSwaySpeed: uniform(0.9),
  uWindVerticalBobStrength: uniform(0.02),
  // scale
  uMinScale: uniform(config.MIN_SCALE),
  uMaxScale: uniform(config.MAX_SCALE),
};

class FlowersSsbo {
  // x -> offsetX (0 unused)
  // y -> offsetZ (0 unused)
  // z -> 0/12 offsetY - 12/1 visibility - 13/6 grass scale (5 unused)
  // w -> noise (0 unused - also not used currently)
  private buffer = instancedArray(config.COUNT, "vec4");

  constructor() {
    this.computeUpdate.name = "Flowers";
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
    const unwrappedOffset = vec2(data.x, data.y).sub(uniforms.uPlayerDeltaXZ);
    const wrappedOffsetX = mod(
      unwrappedOffset.x.add(config.TILE_HALF_SIZE),
      config.TILE_SIZE,
    ).sub(config.TILE_HALF_SIZE);
    const wrappedOffsetZ = mod(
      unwrappedOffset.y.add(config.TILE_HALF_SIZE),
      config.TILE_SIZE,
    ).sub(config.TILE_HALF_SIZE);
    const wrappedOffset = vec3(wrappedOffsetX, 0, wrappedOffsetZ);

    data.x = wrappedOffset.x;
    data.y = wrappedOffset.z;

    const worldPos = wrappedOffset.add(uniforms.uPlayerPosition);
    const clipPosition = uniforms.uCameraMatrix.mul(vec4(worldPos, 1));

    // Visibility
    const isVisible = TSLUtils.computeFrustumVisibility(
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
      const mapUv = TSLUtils.computeMapUvByPosition(worldPos.xz);
      const heightUv = vec2(mapUv.x, float(1).sub(mapUv.y));
      const yOffset = texture(assetManager.resources.heightmap, heightUv).r;
      data.assign(this.setYOffset(data, yOffset));

      // Grass scale
      const grassMapValue = texture(
        assetManager.resources.terrainMaps,
        TSLUtils.computeMapUvByPosition(worldPos.xz),
      ).g;
      const grassScale = grassMapValue
        .sub(0.25)
        .div(1 - 0.25)
        .clamp();
      const grassVisibility = step(0.05, grassScale);
      data.assign(this.setGrassScale(data, grassScale));
      data.assign(this.setVisibility(data, grassVisibility));
    });
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);
}

export default class Flowers {
  private ssbo = new FlowersSsbo();
  private mesh: InstancedMesh;

  constructor() {
    this.mesh = this.createMesh();
    sceneManager.mainScene.add(this.mesh);

    eventsManager.on("engine-render-update-throttle-16x", this.onEngineUpdate);
    this.debug();
  }

  private createMesh() {
    const material = new FlowerMaterial(this.ssbo);
    const mesh = new InstancedMesh(
      new PlaneGeometry(1, 1),
      material,
      config.COUNT,
    );
    return mesh;
  }

  private onEngineUpdate = ({ player }: State) => {
    this.syncFrameUniforms(player.position);
    this.mesh.position.copy(player.position).setY(0);
    this.updateSsbo();
  };

  private syncFrameUniforms(playerPosition: Vector3) {
    const dx = playerPosition.x - this.mesh.position.x;
    const dz = playerPosition.z - this.mesh.position.z;
    uniforms.uPlayerDeltaXZ.value.set(dx, dz);
    uniforms.uPlayerPosition.value.copy(playerPosition);

    const projectionMatrix = sceneManager.playerCamera.projectionMatrix;
    uniforms.uFx.value = projectionMatrix.elements[0];
    uniforms.uFy.value = projectionMatrix.elements[5];
    uniforms.uCameraMatrix.value
      .copy(projectionMatrix)
      .multiply(sceneManager.playerCamera.matrixWorldInverse);
    sceneManager.playerCamera.getWorldDirection(uniforms.uCameraForward.value);
  }

  private updateSsbo() {
    try {
      rendererManager.renderer.compute(this.ssbo.computeUpdate);
    } catch (error) {
      console.error("[Flowers] compute update failed:", error);
    }
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🌸 Flowers",
      expanded: false,
    });

    folder.addBinding(srgbColorTarget(uniforms.uColor1.value), "value", {
      label: "Color 1",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(srgbColorTarget(uniforms.uColor2.value), "value", {
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
    folder.addBinding(uniforms.uMinScale, "value", {
      label: "Min scale",
      min: 0,
      max: 3,
      step: 0.001,
    });
    folder.addBinding(uniforms.uMaxScale, "value", {
      label: "Max scale",
      min: 0,
      max: 3,
      step: 0.001,
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
    const windDirection = windManager.uDirection;
    const windEvent = windManager.uIntensityDirectional;
    const timer = gameTime.mul(uniforms.uWindSwaySpeed);
    const windTravel = x.mul(windDirection.x).add(z.mul(windDirection.y));
    const travelWave = sin(
      windTravel.mul(0.16).sub(timer.mul(2.2)).add(rand3.mul(PI2)),
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
        sin(ambientPhase.mul(1.7).add(rand3.mul(PI2))).mul(
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
      rand1.remap(0, 1, uniforms.uMinScale, uniforms.uMaxScale),
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
