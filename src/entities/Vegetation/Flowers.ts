import {
  deltaTime,
  float,
  floor,
  Fn,
  hash,
  If,
  INFINITY,
  instancedArray,
  instanceIndex,
  sin,
  step,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  SpriteNodeMaterial,
  Vector2,
  Vector3,
} from "three/webgpu";
import {
  assetManager,
  rendererManager,
  sceneManager,
  eventsManager,
  systemState,
} from "../../systems";
import { VegetationSsboUtils } from "./ssboUtils";
import { TSLUtils } from "../../utils/TSLUtils";

const getConfig = () => {
  const FLOWER_WIDTH = 0.5;
  const FLOWER_HEIGHT = 1;
  const TILE_SIZE = 150;
  const FLOWERS_PER_SIDE = 32;
  return {
    FLOWER_WIDTH,
    FLOWER_HEIGHT,
    FLOWER_BOUNDING_SPHERE_RADIUS: FLOWER_HEIGHT,
    TILE_SIZE,
    TILE_HALF_SIZE: TILE_SIZE / 2,
    FLOWERS_PER_SIDE,
    COUNT: FLOWERS_PER_SIDE * FLOWERS_PER_SIDE,
    SPACING: TILE_SIZE / FLOWERS_PER_SIDE,
    WORKGROUP_SIZE: 32,
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
};

class FlowersSsbo {
  // x -> offsetX (0 unused)
  // y -> offsetZ (0 unused)
  // z -> 0/12 offsetY - 12/13 visibility (9 unused)
  // w -> (24 unused)
  private buffer: ReturnType<typeof instancedArray>;

  constructor() {
    this.buffer = instancedArray(config.COUNT, "vec4");
    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
  }

  get computeBuffer() {
    return this.buffer;
  }

  getYOffset = Fn(([data = vec4(0)]) => {
    return TSLUtils.unpackUnits(
      data.z,
      0,
      12,
      0,
      Math.ceil(assetManager.resources.heightmap.userData.max),
    );
  });

  getVisibility = Fn(([data = vec4(0)]) => {
    return TSLUtils.unpackFlag(data.z, 12);
  });

  private setYOffset = Fn(([data = vec4(0), value = float(0)]) => {
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

  private setVisibility = Fn(([data = vec4(0), value = float(0)]) => {
    data.z = TSLUtils.packFlag(data.z, 12, value);
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

    const noise = texture(assetManager.resources.noiseTexture, _uv);

    const noiseX = noise.r.sub(0.5).mul(100);
    const noiseZ = noise.b.sub(0.5).mul(50);

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

    // Visibility
    const isVisible = VegetationSsboUtils.computeVisibility(
      worldPos,
      uniforms.uCameraMatrix,
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

      // Alpha
      const alphaVisibility = VegetationSsboUtils.computeAlpha(worldPos);
      data.assign(this.setVisibility(data, alphaVisibility));
    });
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);
}

export default class Flowers {
  constructor() {
    const ssbo = new FlowersSsbo();
    const material = new FlowerMaterial(ssbo);
    const flowers = new InstancedMesh(
      new PlaneGeometry(1, 1),
      material,
      config.COUNT,
    );
    sceneManager.scene.add(flowers);

    eventsManager.on("engine-update-throttle-2x", ({ player }) => {
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
      rendererManager.renderer.computeAsync(ssbo.computeUpdate);
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

    const data = this.ssbo.computeBuffer.element(instanceIndex);
    const isVisible = this.ssbo.getVisibility(data);
    const x = data.x;
    const y = this.ssbo.getYOffset(data);
    const z = data.y;

    const rand1 = hash(instanceIndex.add(9234));
    const rand2 = hash(instanceIndex.add(33.87));

    // Position
    const windIntensity = systemState.wind.uIntensity;
    const windDirection = systemState.wind.uDirection;
    const timer = time.add(
      deltaTime.mul(float(2).add(windIntensity.mul(0.25))),
    );
    const sway = sin(timer.add(rand1.mul(100))).mul(0.05);
    const offscreenOffset = uniforms.uCameraForward
      .mul(INFINITY)
      .mul(float(1).sub(isVisible));
    const offsetX = x.add(windDirection.x.mul(windIntensity).mul(0.5));
    const offsetY = y.add(rand1.add(rand2));
    const offsetZ = z.add(windDirection.y.mul(windIntensity).mul(0.5));
    const basePosition = vec3(offsetX, offsetY, offsetZ);
    this.positionNode = basePosition
      .add(offscreenOffset)
      .add(vec3(sway, rand2.mul(0.5), sway));

    // Size
    this.scaleNode = vec3(rand1.remap(0, 1, 0.225, 0.25));

    // Diffuse
    const u = step(0.5, rand1).mul(0.5);
    const v = step(0.5, rand2).mul(0.5);

    const baseUv = vec2(uv().x, float(1).sub(uv().y)).mul(0.5);
    const flowerUv = baseUv.add(vec2(u, v));
    const flower = texture(assetManager.resources.flowers, flowerUv);
    // const c = mix(flower.rgb, vec3(0), 0.45);
    this.colorNode = vec3(
      flower.r.add(rand1),
      flower.g.mul(rand1).add(rand2),
      flower.b.mul(rand2),
    ).mul(rand2.add(rand1).clamp(0.5, 1.25));

    // Opacity
    this.opacityNode = isVisible.mul(flower.a);
    this.alphaTest = 0.15;
  }
}
