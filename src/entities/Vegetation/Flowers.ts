import {
  float,
  floor,
  Fn,
  fract,
  hash,
  If,
  instancedArray,
  instanceIndex,
  mod,
  positionLocal,
  rotate,
  sin,
  step,
  texture,
  uniform,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import {
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertNodeMaterial,
  Vector2,
  Vector3,
} from "three/webgpu";
import { assetManager } from "../../systems/AssetManager";
import { rendererManager } from "../../systems/RendererManager";
import { sceneManager } from "../../systems/SceneManager";
import { eventsManager } from "../../systems/EventsManager";
import { UniformType } from "../../types";
import { State } from "../../Game";
import { realmConfig } from "../../realms/PortfolioRealm";

const getConfig = () => {
  const FLOWER_WIDTH = 3;
  const FLOWER_HEIGHT = 3;
  const TILE_SIZE = 150;
  const FLOWERS_PER_SIDE = 20;
  return {
    FLOWER_WIDTH,
    FLOWER_HEIGHT,
    BLADE_BOUNDING_SPHERE_RADIUS: FLOWER_HEIGHT,
    TILE_SIZE,
    TILE_HALF_SIZE: TILE_SIZE / 2,
    FLOWERS_PER_SIDE,
    COUNT: FLOWERS_PER_SIDE * FLOWERS_PER_SIDE,
    SPACING: TILE_SIZE / FLOWERS_PER_SIDE,
  };
};
const flowersConfig = getConfig();

export class Flowers {
  private flowerField: InstancedMesh;
  private material: FlowerMaterial;
  private uniforms = {
    ...defaultUniforms,
    uDelta: uniform(new Vector2(0, 0)),
    uPlayerPosition: uniform(new Vector3(0, 0, 0)),
    uCameraMatrix: uniform(new Matrix4()),
    uTime: uniform(0),
  };

  constructor() {
    const flowerPlane = assetManager.realmModel.scene.getObjectByName(
      "flowers_plane",
    ) as Mesh;
    flowerPlane.geometry.translate(0, 0.35, 0);
    this.material = new FlowerMaterial(this.uniforms);
    this.flowerField = new InstancedMesh(
      flowerPlane.geometry,
      this.material,
      flowersConfig.COUNT,
    );
    sceneManager.scene.add(this.flowerField);
    eventsManager.on("update", this.updateAsync.bind(this));
  }

  private async updateAsync(state: State) {
    const { player, clock } = state;
    const dx = player.position.x - this.flowerField.position.x;
    const dz = player.position.z - this.flowerField.position.z;
    this.uniforms.uDelta.value.set(dx, dz);
    this.uniforms.uPlayerPosition.value.copy(player.position);
    this.uniforms.uCameraMatrix.value
      .copy(sceneManager.camera.projectionMatrix)
      .multiply(sceneManager.camera.matrixWorldInverse);
    this.uniforms.uTime.value = clock.getElapsedTime();

    this.flowerField.position.copy(player.position).setY(0);

    await this.material.updateAsync();
  }
}

type FlowersUniforms = {
  uTime?: UniformType<number>;
  uPlayerPosition?: UniformType<Vector3>;
  uCameraMatrix?: UniformType<Matrix4>;
  // Scale
  uFlowersMinScale?: UniformType<number>;
  uFlowersMaxScale?: UniformType<number>;
  // Updated externally
  uDelta: UniformType<Vector2>;
};

const defaultUniforms: Required<FlowersUniforms> = {
  uTime: uniform(0),
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uCameraMatrix: uniform(new Matrix4()),
  // Scale
  uFlowersMinScale: uniform(1.25),
  uFlowersMaxScale: uniform(1.75),
  // Updated externally
  uDelta: uniform(new Vector2(0, 0)),
};

class FlowerMaterial extends MeshLambertNodeMaterial {
  private _uniforms: FlowersUniforms;
  private _buffer1: ReturnType<typeof instancedArray>; // holds: vec4 = (localOffset.x, localOffset.y, yaw, alpha)
  private _buffer2: ReturnType<typeof instancedArray>; // holds: float = (scale)

  constructor(uniforms: FlowersUniforms) {
    super();
    this._uniforms = { ...defaultUniforms, ...uniforms };

    this._buffer1 = instancedArray(flowersConfig.COUNT, "vec4");
    this._buffer1.setPBO(true);
    this._buffer2 = instancedArray(flowersConfig.COUNT, "float");
    this._buffer2.setPBO(true);

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });

    this.createFlowerMaterial();
  }

  private computeInit = Fn(() => {
    const data1 = this._buffer1.element(instanceIndex);
    // Position XZ
    const row = floor(float(instanceIndex).div(flowersConfig.FLOWERS_PER_SIDE));
    const col = float(instanceIndex).mod(flowersConfig.FLOWERS_PER_SIDE);

    const randX = hash(instanceIndex.add(4321));
    const randZ = hash(instanceIndex.add(1234));
    const offsetX = col
      .mul(flowersConfig.SPACING)
      .sub(flowersConfig.TILE_HALF_SIZE)
      .add(randX.mul(flowersConfig.SPACING * 0.5));
    const offsetZ = row
      .mul(flowersConfig.SPACING)
      .sub(flowersConfig.TILE_HALF_SIZE)
      .add(randZ.mul(flowersConfig.SPACING * 0.5));

    const _uv = vec3(offsetX, 0, offsetZ)
      .xz.add(flowersConfig.TILE_HALF_SIZE)
      .div(flowersConfig.TILE_SIZE)
      .abs();

    const noiseX = texture(assetManager.noiseTexture, _uv).b.sub(0.5).mul(100);
    const noiseZ = texture(assetManager.noiseTexture, _uv).g.sub(0.5).mul(50);

    data1.x = offsetX.add(noiseX);
    data1.y = offsetZ.add(noiseZ);

    const worldPos = vec3(data1.x, 0, data1.y);

    // Yaw
    const noiseUV = worldPos.xz
      .add(flowersConfig.TILE_HALF_SIZE)
      .div(flowersConfig.TILE_SIZE);
    const noiseScale = float(20);
    const uv = fract(noiseUV.mul(noiseScale));
    const noiseValue = texture(assetManager.noiseTexture, uv, 1).b;
    const yawVariation = noiseValue.sub(0.5).mul(float(Math.PI * 2)); // Map noise to [-PI, PI]
    data1.z = yawVariation;

    // Scale
    const data2 = this._buffer2.element(instanceIndex);
    const scaleRange = this._uniforms.uFlowersMaxScale.sub(
      this._uniforms.uFlowersMinScale,
    );
    const randomScale = hash(instanceIndex.add(100))
      .mul(scaleRange)
      .add(this._uniforms.uFlowersMinScale);

    data2.assign(randomScale);
  })().compute(flowersConfig.COUNT);

  private computeVisibility = Fn(([worldPos = vec3(0)]) => {
    const clipPos = this._uniforms.uCameraMatrix.mul(vec4(worldPos, 1.0));

    // Convert to normalized device coordinates
    const ndc = clipPos.xyz.div(clipPos.w);

    // Compute an approximate threshold for the blade's radius in NDC space.
    const radiusNDC = flowersConfig.BLADE_BOUNDING_SPHERE_RADIUS;

    // Check if the sphere (centered at ndc with "radiusNDC") is at least partially within the clip volume:
    const one = float(1);
    const visible = step(one.negate().sub(radiusNDC), ndc.x)
      .mul(step(ndc.x, one.add(radiusNDC)))
      .mul(step(one.negate().sub(radiusNDC), ndc.y))
      .mul(step(ndc.y, one.add(radiusNDC)))
      .mul(step(0.0, ndc.z)) // Ensure it's in front of the near plane
      .mul(step(ndc.z, one)); // Ensure it's inside the far plane

    // visible will be 1 if inside, 0 if outside.
    return visible;
  });

  private computeAlpha = Fn(([worldPos = vec3(0)]) => {
    const alphaUv = worldPos.xz
      .add(realmConfig.HALF_MAP_SIZE)
      .div(realmConfig.MAP_SIZE);
    return floor(texture(assetManager.floorGrassWaterMap, alphaUv).g);
  });

  private computeUpdate = Fn(() => {
    const data1 = this._buffer1.element(instanceIndex);
    // Position
    const newOffsetX = mod(
      data1.x.sub(this._uniforms.uDelta.x).add(flowersConfig.TILE_HALF_SIZE),
      flowersConfig.TILE_SIZE,
    ).sub(flowersConfig.TILE_HALF_SIZE);
    const newOffsetZ = mod(
      data1.y.sub(this._uniforms.uDelta.y).add(flowersConfig.TILE_HALF_SIZE),
      flowersConfig.TILE_SIZE,
    ).sub(flowersConfig.TILE_HALF_SIZE);
    data1.x = newOffsetX;
    data1.y = newOffsetZ;

    const pos = vec3(data1.x, 0, data1.y);
    const worldPos = pos.add(this._uniforms.uPlayerPosition);

    // Visibility
    const isVisible = this.computeVisibility(worldPos);
    data1.w = isVisible;

    If(isVisible, () => {
      // Alpha
      data1.w = this.computeAlpha(worldPos);
    });
  })().compute(flowersConfig.COUNT);

  private computePosition = Fn(([data1 = vec4(0), data2 = float(0)]) => {
    const offset = vec3(data1.x, 0, data1.y);
    const yawAngle = data1.z;
    const scaled = positionLocal.mul(vec3(data2));

    const rand = hash(instanceIndex);
    const swayAmount = sin(this._uniforms.uTime.mul(5.0).mul(rand)).mul(0.015);
    const rotated = rotate(
      scaled,
      vec3(swayAmount, yawAngle.mul(2), swayAmount.mul(2)),
    );

    const worldPosition = rotated.add(offset);
    return worldPosition;
  });

  private createFlowerMaterial() {
    this.precision = "lowp";
    const data1 = this._buffer1.element(instanceIndex);
    const data2 = this._buffer2.element(instanceIndex);
    this.positionNode = this.computePosition(data1, data2);
    this.opacityNode = data1.w;
    this.alphaTest = 0.25;

    const factor1 = mod(float(instanceIndex), 2);
    const factor2 = float(1).sub(factor1);

    const composition1 = texture(assetManager.flowerCompositionTexture_1, uv())
      .mul(factor1)
      .mul(1.25);
    const composition2 = texture(assetManager.flowerCompositionTexture_2, uv())
      .mul(factor2)
      .mul(1.5);

    const composition = composition1.add(composition2);

    this.colorNode = composition;
  }

  async updateAsync() {
    await rendererManager.renderer.computeAsync(this.computeUpdate);
  }
}
