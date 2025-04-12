import {
  float,
  floor,
  Fn,
  hash,
  If,
  instancedArray,
  instanceIndex,
  mix,
  mod,
  positionLocal,
  rotate,
  sin,
  step,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  vertexIndex,
} from "three/tsl";
import {
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicNodeMaterial,
  Vector2,
  Vector3,
} from "three/webgpu";
import { assetManager } from "../../systems/AssetManager";
import { rendererManager } from "../../systems/RendererManager";
import { sceneManager } from "../../systems/SceneManager";
import { eventsManager } from "../../systems/EventsManager";
import { UniformType } from "../../types";
import { State } from "../../Game";
import { tslUtils } from "../../systems/TSLUtils";
import { debugManager } from "../../systems/DebugManager";

const getConfig = () => {
  const FLOWER_WIDTH = 3;
  const FLOWER_HEIGHT = 2;
  const TILE_SIZE = 150;
  const FLOWERS_PER_SIDE = 4;
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

export default class Plants {
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
    const basePlant = assetManager.realmModel.scene.getObjectByName(
      "base_plant",
    ) as Mesh;
    this.material = new FlowerMaterial(this.uniforms);
    this.flowerField = new InstancedMesh(
      basePlant.geometry,
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
  uTime: UniformType<number>;
  uPlayerPosition: UniformType<Vector3>;
  uCameraMatrix: UniformType<Matrix4>;
  uDelta: UniformType<Vector2>;
  uTipColor: UniformType<Color>;
};

const defaultUniforms: Required<FlowersUniforms> = {
  uTime: uniform(0),
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uCameraMatrix: uniform(new Matrix4()),
  uDelta: uniform(new Vector2(0, 0)),
  uTipColor: uniform(new Color().setRGB(0, 0, 0)),
};

class FlowerMaterial extends MeshBasicNodeMaterial {
  private _uniforms: FlowersUniforms;
  private _buffer1: ReturnType<typeof instancedArray>; // holds: vec4 = (localOffset.x, localOffset.z, scale, alpha)
  private _buffer2: ReturnType<typeof instancedArray>; // holds: float = (yaw)

  constructor(uniforms: Partial<FlowersUniforms>) {
    super();
    this._uniforms = { ...defaultUniforms, ...uniforms };

    this._buffer1 = instancedArray(flowersConfig.COUNT, "vec4");
    this._buffer1.setPBO(true);
    this._buffer2 = instancedArray(flowersConfig.COUNT, "float");
    this._buffer2.setPBO(true);

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });

    this.createMaterial();

    debugManager.panel.addBinding(this._uniforms.uTipColor, "value", {
      view: "color",
      color: { type: "float" },
    });
  }

  private computeInit = Fn(() => {
    const data1 = this._buffer1.element(instanceIndex);
    const data2 = this._buffer2.element(instanceIndex);
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

    const noise = texture(assetManager.noiseTexture, _uv);
    const mixedNoise = noise.r;

    const noiseX = mixedNoise.sub(0.5).mul(100);
    const noiseZ = mixedNoise.sub(0.5).mul(50);

    data1.x = offsetX.add(noiseX);
    data1.y = offsetZ.add(noiseZ);

    // Scale
    data1.z = hash(instanceIndex).add(0.25).clamp(0.75, 1);

    // Yaw
    const yawVariation = noise.r.sub(0.5).mul(float(Math.PI * 2)); // Map noise to [-PI, PI]
    data2.assign(yawVariation);
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
    const alphaUv = tslUtils.computeMapUvByPosition(worldPos.xz);
    return texture(assetManager.terrainTypeMap, alphaUv).g;
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

  private computePosition = Fn(
    ([rand = float(0), data1 = vec4(0), data2 = float(0)]) => {
      const factor = float(1).sub(uv().y);

      const offset = vec3(data1.x, rand.mul(rand).mul(factor), data1.y);
      const scale = data1.z;
      const scaled = positionLocal.mul(
        vec3(scale.mul(1.5), scale, scale.mul(1.5)),
      );
      const rotated = rotate(scaled, vec3(0, data2, 0));

      const timer = this._uniforms.uTime.mul(2);
      const sway = sin(timer.add(rand.mul(100)).add(vertexIndex))
        .mul(0.1)
        .mul(factor);

      const worldPosition = rotated.add(offset).add(vec3(0, sway, 0));
      return worldPosition;
    },
  );

  private computeDiffuse = Fn(([rand = float(0)]) => {
    const ambienceColor = vec4(this._uniforms.uTipColor.rgb, 0.3);

    // Diffuse
    const u = step(0.5, rand).mul(0.5);

    const baseUv = uv().mul(vec2(0.5, 1));
    const leafUv = baseUv.add(vec2(u, 0));
    const diff = texture(assetManager.plantAtlas, leafUv);

    const factor = uv().y;
    const finalColor = mix(ambienceColor, diff.mul(0.75), factor);
    return vec4(finalColor.rgb, diff.a.sub(ambienceColor.a)).mul(0.2);
  });

  private createMaterial() {
    this.precision = "lowp";
    const data1 = this._buffer1.element(instanceIndex);
    const data2 = this._buffer2.element(instanceIndex);

    const rand = hash(instanceIndex.add(9234));

    // Position
    this.positionNode = this.computePosition(rand, data1, data2);

    // Diffuse
    this.colorNode = this.computeDiffuse(rand);

    // Opacity
    this.opacityNode = data1.w;
    this.alphaTest = 0.05;
  }

  async updateAsync() {
    await rendererManager.renderer.computeAsync(this.computeUpdate);
  }
}
