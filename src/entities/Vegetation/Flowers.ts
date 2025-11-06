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
} from "../../systems";
import { VegetationSsboUtils } from "./ssboUtils";

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
  uCullPadNDC: uniform(0.075), // small padding to hide rotation lag
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
  private _buffer1: ReturnType<typeof instancedArray>; // holds: vec4 = (localOffset.x, localOffset.y, localOffset.z, alpha)

  constructor() {
    super();

    this._buffer1 = instancedArray(config.COUNT, "vec4");
    this._buffer1.setPBO(true);

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });

    this.createMaterial();
  }

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
    const noiseY = noise.g.clamp(0.5, 0.75);
    const noiseZ = noise.b.sub(0.5).mul(50);

    data1.x = offsetX.add(noiseX);
    data1.y = noiseY;
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
      uniforms.uCullPadNDC,
    );
    data1.w = isVisible;

    If(isVisible, () => {
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
    const timer = time.mul(2);
    const sway = sin(timer.add(rand1.mul(100))).mul(0.05);
    const offscreenOffset = uniforms.uCameraForward
      .mul(INFINITY)
      .mul(float(1).sub(data1.w));
    this.positionNode = data1.xyz
      .add(offscreenOffset)
      .add(vec3(sway, rand2.mul(0.5), sway));

    // Size
    // this.scaleNode = rand1.mul(0.2).add(0.3);
    this.scaleNode = vec3(rand1.remap(0, 1, 0.25, 0.4));

    // Diffuse
    const u = step(0.5, rand1).mul(0.5);
    const v = step(0.5, rand2).mul(0.5);

    const baseUv = uv().mul(0.5);
    const flowerUv = baseUv.add(vec2(u, v));
    const flower = texture(assetManager.resources.flowerAtlas, flowerUv);
    const c = mix(flower.rgb, vec3(1), 0.05);
    this.colorNode = vec4(c, flower.a);

    // Opacity
    this.opacityNode = data1.w;
    this.alphaTest = 0.15;
  }

  async updateAsync() {
    rendererManager.renderer.computeAsync(this.computeUpdate);
  }
}
