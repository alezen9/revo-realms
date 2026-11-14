import {
  atomicAdd,
  atomicStore,
  cos,
  float,
  floor,
  Fn,
  hash,
  If,
  instancedArray,
  instanceIndex,
  min,
  mix,
  mod,
  PI2,
  sin,
  smoothstep,
  step,
  texture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { StorageArrayElementNode } from "three/webgpu";
import { assets, stage } from "../../systems";
import { computeMapUvByPosition } from "../../shaders/mapping";
import { computeFrustumVisibility } from "../../shaders/frustum";
import { gameDeltaTime } from "../../systems/time/gameTime";
import { config, uniforms } from "./pampasConfig";

const {
  COUNT,
  PLANTS_PER_CLUMP,
  CLUMPS_PER_SIDE,
  CLUMP_SPACING,
  TILE_HALF_SIZE,
  CLUMP_RADIUS,
  TILE_SIZE,
  PLAYER_PUSH_RADIUS,
  PLANT_HEIGHT,
  RECOVERY_RATE,
  PRESS_RATE,
  MIN_CLUMP_FULLNESS,
  WORKGROUP_SIZE,
} = config;

type PlantBuffer = ReturnType<typeof createPlantBuffer>;
type BendBuffer = ReturnType<typeof createBendBuffer>;
type IndexBuffer = ReturnType<typeof createIndexBuffer>;
type Counter = StorageArrayElementNode<"uint">;

const createPlantBuffer = () => instancedArray(COUNT, "vec4");
const createBendBuffer = () => instancedArray(COUNT, "vec2");
const createIndexBuffer = () => instancedArray(COUNT, "uint");

const getClumpIndex = () => instanceIndex.div(PLANTS_PER_CLUMP);

const initPlants = Fn<[plants: PlantBuffer], void>(([plants]) => {
  const plant = plants.element(instanceIndex);

  const clumpIndex = getClumpIndex();
  const row = floor(float(clumpIndex).div(CLUMPS_PER_SIDE));
  const column = float(clumpIndex).mod(CLUMPS_PER_SIDE);
  const clumpJitter = vec2(
    hash(clumpIndex.add(4321)),
    hash(clumpIndex.add(1234)),
  );
  const clumpCenter = vec2(column, row)
    .add(clumpJitter)
    .mul(CLUMP_SPACING)
    .sub(TILE_HALF_SIZE);

  const angle = hash(instanceIndex.add(577)).mul(PI2);
  const radius = hash(instanceIndex.add(9241)).sqrt().mul(CLUMP_RADIUS);

  plant.x = clumpCenter.x.add(cos(angle).mul(radius));
  plant.y = clumpCenter.y.add(sin(angle).mul(radius));
});

const updatePlants = Fn<
  [
    plants: PlantBuffer,
    bends: BendBuffer,
    visibleIndices: IndexBuffer,
    visibleCount: Counter,
  ],
  void
>(([plants, bends, visibleIndices, visibleCount]) => {
  const plant = plants.element(instanceIndex);

  const unwrappedOffset = vec2(plant.x, plant.y).sub(uniforms.uPlayerDeltaXZ);
  const offset = mod(unwrappedOffset.add(TILE_HALF_SIZE), TILE_SIZE).sub(
    TILE_HALF_SIZE,
  );
  plant.x = offset.x;
  plant.y = offset.y;

  const playerDistance = offset.length();
  const playerHeight = uniforms.uPlayerPosition.y.sub(plant.z);
  const press = smoothstep(PLAYER_PUSH_RADIUS, 0, playerDistance).mul(
    smoothstep(PLANT_HEIGHT, 1, playerHeight),
  );
  const pressedBend = offset.div(playerDistance.max(0.01)).mul(press);
  const bend = bends.element(instanceIndex);
  const isBendingFurther = step(bend.length(), press);
  const bendRate = mix(RECOVERY_RATE, PRESS_RATE, isBendingFurther);
  bend.assign(mix(bend, pressedBend, min(bendRate.mul(gameDeltaTime), 1)));

  const worldPos = vec3(offset.x, 0, offset.y).add(uniforms.uPlayerPosition);
  const clipPosition = stage.uCameraMatrix.mul(vec4(worldPos, 1));
  const isVisible = computeFrustumVisibility(
    clipPosition,
    stage.uFx,
    stage.uFy,
    PLANT_HEIGHT,
    uniforms.uCullPadNDCX,
    uniforms.uCullPadNDCYNear,
    uniforms.uCullPadNDCYFar,
  );

  If(isVisible.greaterThan(0), () => {
    const mapUv = computeMapUvByPosition(worldPos.xz);
    const heightUv = vec2(mapUv.x, float(1).sub(mapUv.y));
    plant.z = texture(assets.resources.heightmap, heightUv).r;

    const growth = texture(assets.resources.terrainMasks, mapUv).r;
    plant.w = growth;

    const clumpIndex = getClumpIndex();
    const clumpChance = hash(clumpIndex.add(7919));
    const isClumpGrowing = step(clumpChance, growth.mul(uniforms.uDensity));
    const clumpFullness = mix(MIN_CLUMP_FULLNESS, 1, hash(clumpIndex.add(331)));
    const isInClump = step(hash(instanceIndex.add(613)), clumpFullness);
    const isGrowing = isClumpGrowing.mul(isInClump);

    If(isGrowing.greaterThan(0), () => {
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

export class PampasCompute {
  // x -> offsetX, y -> offsetZ, z -> terrain height, w -> growth
  readonly plants = createPlantBuffer();
  readonly bends = createBendBuffer();
  readonly visiblePlantIndices = createIndexBuffer();
  readonly computeInit;
  readonly computeUpdate;
  readonly computeResetInstanceCount;

  constructor(visibleCount: Counter) {
    const workgroup = [WORKGROUP_SIZE];
    this.computeInit = initPlants(this.plants).compute(COUNT, workgroup);
    this.computeUpdate = updatePlants(
      this.plants,
      this.bends,
      this.visiblePlantIndices,
      visibleCount,
    ).compute(COUNT, workgroup);
    this.computeUpdate.name = "Pampas";
    this.computeResetInstanceCount = resetVisibleCount(visibleCount).compute(
      1,
      [1],
    );
  }
}
