import {
  atomicAdd,
  atomicStore,
  float,
  floor,
  Fn,
  hash,
  If,
  instancedArray,
  instanceIndex,
  mod,
  step,
  texture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { Node, StorageArrayElementNode } from "three/webgpu";
import { assets, stage } from "../../systems";
import {
  packFlag,
  packUnit,
  packUnits,
  unpackUnit,
  unpackUnits,
} from "../../shaders/packing";
import { computeMapUvByPosition } from "../../shaders/mapping";
import { computeFrustumVisibility } from "../../shaders/frustum";
import { config, uniforms } from "./config";

type FlowerData = Node<"vec4">;
type FlowerBuffer = ReturnType<typeof createFlowerBuffer>;
type IndexBuffer = ReturnType<typeof createIndexBuffer>;
type Counter = StorageArrayElementNode<"uint">;

const createFlowerBuffer = () => instancedArray(config.COUNT, "vec4");
const createIndexBuffer = () => instancedArray(config.COUNT, "uint");

export const getYOffset = Fn<[data: FlowerData], Node<"float">>(([data]) =>
  unpackUnits(
    data.z,
    0,
    12,
    0,
    Math.ceil(assets.resources.heightmap.userData.max),
  ),
);

export const getGrassScale = Fn<[data: FlowerData], Node<"float">>(([data]) =>
  unpackUnit(data.z, 13, 6),
);

export const getNoise = Fn<[data: FlowerData], Node<"vec4">>(([data]) =>
  vec4(
    unpackUnit(data.w, 0, 6),
    unpackUnit(data.w, 6, 6),
    unpackUnit(data.w, 12, 6),
    unpackUnit(data.w, 18, 6),
  ),
);

const setYOffset = Fn<[data: FlowerData, value: Node<"float">], FlowerData>(
  ([data, value]) => {
    data.z = packUnits(
      data.z,
      0,
      12,
      value,
      0,
      Math.ceil(assets.resources.heightmap.userData.max),
    );
    return data;
  },
);

const setVisibility = Fn<[data: FlowerData, value: Node<"float">], FlowerData>(
  ([data, value]) => {
    data.z = packFlag(data.z, 12, value);
    return data;
  },
);

const setGrassScale = Fn<[data: FlowerData, value: Node<"float">], FlowerData>(
  ([data, value]) => {
    data.z = packUnit(data.z, 13, 6, value);
    return data;
  },
);

const setNoise = Fn<[data: FlowerData, value: Node<"vec4">], FlowerData>(
  ([data, value]) => {
    data.w = packUnit(data.w, 0, 6, value.x);
    data.w = packUnit(data.w, 6, 6, value.y);
    data.w = packUnit(data.w, 12, 6, value.z);
    data.w = packUnit(data.w, 18, 6, value.a);
    return data;
  },
);

const initFlowers = Fn<[flowers: FlowerBuffer], void>(([flowers]) => {
  const data = flowers.element(instanceIndex);

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

  const tileUv = vec3(offsetX, 0, offsetZ)
    .xz.add(config.TILE_HALF_SIZE)
    .div(config.TILE_SIZE)
    .abs();

  const noise = texture(assets.resources.noiseAtlas, tileUv);
  data.assign(setNoise(data, noise));
  const noiseX = noise.r.mul(99.37);
  const noiseZ = noise.g.mul(49.71);

  data.x = offsetX.add(noiseX);
  data.y = offsetZ.add(noiseZ);
});

const updateFlowers = Fn<
  [flowers: FlowerBuffer, visibleIndices: IndexBuffer, visibleCount: Counter],
  void
>(([flowers, visibleIndices, visibleCount]) => {
  const data = flowers.element(instanceIndex);
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
  const clipPosition = stage.uCameraMatrix.mul(vec4(worldPos, 1));

  const isVisible = computeFrustumVisibility(
    clipPosition,
    stage.uFx,
    stage.uFy,
    config.FLOWER_BOUNDING_SPHERE_RADIUS,
    uniforms.uCullPadNDCX,
    uniforms.uCullPadNDCYNear,
    uniforms.uCullPadNDCYFar,
  );

  data.assign(setVisibility(data, isVisible));

  If(isVisible.greaterThan(0), () => {
    const mapUv = computeMapUvByPosition(worldPos.xz);
    const heightUv = vec2(mapUv.x, float(1).sub(mapUv.y));
    const yOffset = texture(assets.resources.heightmap, heightUv).r;
    data.assign(setYOffset(data, yOffset));

    const grassMapValue = texture(
      assets.resources.terrainMaps,
      computeMapUvByPosition(worldPos.xz),
    ).g;
    const grassScale = grassMapValue
      .sub(0.5)
      .div(1 - 0.5)
      .clamp();
    const grassVisibility = step(0.05, grassScale);
    data.assign(setGrassScale(data, grassScale));
    data.assign(setVisibility(data, grassVisibility.mul(isVisible)));

    If(isVisible, () => {
      const drawIndex = atomicAdd(visibleCount, 1);
      visibleIndices.element(drawIndex).assign(instanceIndex);
    });
  });
});

const resetVisibleCount = Fn<[visibleCount: Counter], void>(
  ([visibleCount]) => {
    atomicStore(visibleCount, 0);
  },
);

export class FlowersCompute {
  // x -> offsetX (0 unused)
  // y -> offsetZ (0 unused)
  // z -> 0/12 offsetY - 12/1 visibility - 13/6 grass scale (5 unused)
  // w -> noise (0 unused - also not used currently)
  readonly flowers = createFlowerBuffer();
  readonly visibleFlowerIndices = createIndexBuffer();
  readonly computeInit;
  readonly computeUpdate;
  readonly computeResetInstanceCount;

  constructor(visibleCount: Counter) {
    const workgroup = [config.WORKGROUP_SIZE];
    this.computeInit = initFlowers(this.flowers).compute(
      config.COUNT,
      workgroup,
    );
    this.computeUpdate = updateFlowers(
      this.flowers,
      this.visibleFlowerIndices,
      visibleCount,
    ).compute(config.COUNT, workgroup);
    this.computeUpdate.name = "Flowers";
    this.computeResetInstanceCount = resetVisibleCount(visibleCount).compute(
      1,
      [1],
    );
  }
}
