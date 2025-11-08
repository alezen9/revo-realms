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
  mix,
  sin,
  smoothstep,
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
import { tslUtils } from "../../utils/TSLUtils";

const getConfig = () => {
  const FLOWER_WIDTH = 0.5;
  const FLOWER_HEIGHT = 1;
  const TILE_SIZE = 150;
  const FLOWERS_PER_SIDE = 64;
  return {
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
  uDelta: uniform(new Vector2(0, 0)),
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uCameraMatrix: uniform(new Matrix4()), // MVP = Projection * View
  uFx: uniform(1.0),
  uFy: uniform(1.0),
  uCullPadNDCX: uniform(0.075), // small padding to hide rotation lag
  uCullPadNDCY: uniform(0.75), // small padding to avoid near clipping
  uCameraForward: uniform(new Vector3(0, 0, 0)),
};

export default class Flowers {
  constructor() {
    const material = new FlowerMaterial();
    const flowers = new InstancedMesh(
      new PlaneGeometry(1, 1),
      material,
      config.COUNT,
    );
    sceneManager.scene.add(flowers);

    eventsManager.on("engine-update-throttle-2x", ({ player }) => {
      const dx = player.position.x - flowers.position.x;
      const dz = player.position.z - flowers.position.z;
      uniforms.uPlayerPosition.value.copy(player.position);
      uniforms.uDelta.value.set(dx, dz);

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
      material.updateAsync();
    });
  }
}

class FlowerMaterial extends SpriteNodeMaterial {
  private _buffer1: ReturnType<typeof instancedArray>; // holds: vec4 = (localOffset.x, localOffset.y (0/6 base - 6/18 heightmap), localOffset.z, alpha)

  constructor() {
    super();

    this._buffer1 = instancedArray(config.COUNT, "vec4");
    this._buffer1.setPBO(true);

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });

    this.createMaterial();
  }

  private getYBase = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackUnits(data.y, 0, 6, 0.5, 1.25);
  });

  private getYOffset = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackUnits(data.y, 6, 18, 0, 10);
  });

  private setYBase = Fn(([data = vec4(0), value = float(0)]) => {
    return tslUtils.packUnits(data.y, 0, 6, value, 0.5, 1.25);
  });

  private setYOffset = Fn(([data = vec4(0), value = float(0)]) => {
    return tslUtils.packUnits(data.y, 6, 18, value, 0, 10);
  });

  private computeInit = Fn(() => {
    const data1 = this._buffer1.element(instanceIndex);
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
    const noiseY = noise.g.remap(0, 1, 0.5, 1.25);
    const noiseZ = noise.b.sub(0.5).mul(50);

    data1.x = offsetX.add(noiseX);
    data1.y = this.setYBase(data1, noiseY);
    data1.z = offsetZ.add(noiseZ);
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);

  private computeUpdate = Fn(() => {
    const data1 = this._buffer1.element(instanceIndex);
    // Position
    const pos = VegetationSsboUtils.wrapPosition(
      vec2(data1.x, data1.z),
      uniforms.uDelta,
      config.TILE_SIZE,
    );

    data1.x = pos.x;
    data1.z = pos.z;

    const worldPos = pos.add(uniforms.uPlayerPosition);

    // Visibility
    const isVisible = VegetationSsboUtils.computeVisibility(
      worldPos,
      uniforms.uCameraMatrix,
      uniforms.uFx,
      uniforms.uFy,
      config.FLOWER_BOUNDING_SPHERE_RADIUS,
      uniforms.uCullPadNDCX,
      uniforms.uCullPadNDCY,
    );
    data1.w = isVisible;

    If(isVisible, () => {
      // Y offset
      const yOffset = VegetationSsboUtils.computeYOffset(worldPos);
      const baseYOffset = this.getYBase(data1);
      data1.y = this.setYOffset(data1, baseYOffset.add(yOffset));

      // Alpha
      data1.w = VegetationSsboUtils.computeAlpha(worldPos);
    });
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);

  private createMaterial() {
    this.precision = "lowp";
    const data1 = this._buffer1.element(instanceIndex);
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
      .mul(float(1).sub(data1.w));
    const offsetX = data1.x.add(windDirection.x.mul(windIntensity).mul(0.5));
    const offsetZ = data1.z.add(windDirection.y.mul(windIntensity).mul(0.5));
    const basePosition = vec3(offsetX, this.getYOffset(data1), offsetZ);
    this.positionNode = basePosition
      .add(offscreenOffset)
      .add(vec3(sway, rand2.mul(0.5), sway));

    // Size
    this.scaleNode = vec3(rand1.remap(0, 1, 0.25, 0.3));

    // Diffuse
    const u = step(0.5, rand1).mul(0.5);
    const v = step(0.5, rand2).mul(0.5);

    const baseUv = vec2(uv().x, float(1).sub(uv().y)).mul(0.5);
    const flowerUv = baseUv.add(vec2(u, v));
    const flower = texture(assetManager.resources.flowers, flowerUv);
    // const c = mix(flower.rgb, vec3(0), 0.45);
    this.colorNode = flower;

    // Opacity
    this.opacityNode = data1.w;
    this.alphaTest = 0.15;
  }

  async updateAsync() {
    rendererManager.renderer.computeAsync(this.computeUpdate);
  }
}
