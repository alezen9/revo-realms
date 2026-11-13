import { MathUtils, Mesh } from "three";
import { type State } from "../../Game";
import { assets, eventBus, graphics, stage } from "../../systems";
import { config } from "./KoiConfig";
import { debugKoi } from "./KoiDebug";
import { KoiMaterial } from "./KoiMaterial";
import {
  steerFish,
  type Fish,
  type KoiLake,
  type KoiLakeField,
} from "./KoiSteering";

const {
  FISH_COUNT,
  COLORINGS,
  SIZES,
  CRUISE_SPEED,
  FLEE_SPEED,
  MIN_CALM_HEIGHT_RATIO,
  MAX_CALM_HEIGHT_RATIO,
  SPAWN_CLEARANCE,
  SPAWN_SPACING,
  SPAWN_SEED,
  CRUISE_BEAT_RATE,
  BEAT_RATE_PER_SPEED,
  CRUISE_SWING,
  FLEE_SWING,
} = config;

const HEADER_LENGTH = 6;

export class Koi {
  private lake: KoiLake;

  constructor() {
    const { koiModel, koiLakeField } = assets.resources;
    const { geometry } = assets.getMesh("koi", koiModel);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    if (!bounds) throw new Error("Koi has no bounding box");
    const bodyLength = bounds.max.z - bounds.min.z;

    const { buffer, byteOffset, byteLength } = koiLakeField;
    const fieldFloats = new Float32Array(buffer, byteOffset, byteLength / 4);
    const [originX, originZ, cellSize, columns, rows, swimCeiling] =
      fieldFloats;
    const field = {
      originX,
      originZ,
      cellSize,
      columns,
      rows,
      swimCeiling,
      values: fieldFloats.subarray(HEADER_LENGTH),
    };

    MathUtils.seededRandom(SPAWN_SEED);
    const spawnCells = findSpawnCells(field);
    const fishes: Fish[] = [];
    for (const [index, cell] of spawnCells.entries()) {
      const coloring = assets.resources[COLORINGS[index % COLORINGS.length]];
      const material = new KoiMaterial(coloring, bounds.max.z, bodyLength);
      const mesh = new Mesh(geometry, material);
      mesh.scale.setScalar(SIZES[index % SIZES.length]);

      const calmHeightRatio = MathUtils.lerp(
        MIN_CALM_HEIGHT_RATIO,
        MAX_CALM_HEIGHT_RATIO,
        MathUtils.seededRandom(),
      );
      const column = cell % columns;
      const row = Math.floor(cell / columns);
      const swimFloor = field.values[cell * 2 + 1];
      mesh.position.set(
        originX + column * cellSize,
        MathUtils.lerp(swimFloor, swimCeiling, calmHeightRatio),
        originZ + row * cellSize,
      );
      const yaw = MathUtils.seededRandom() * Math.PI * 2;
      mesh.rotation.y = yaw;
      stage.mainScene.add(mesh);
      graphics.vsmPass.registerCaster(mesh, { type: "dynamic" });

      fishes.push({
        mesh,
        material,
        speed: CRUISE_SPEED,
        yaw,
        turnRate: 0,
        fleeTime: 0,
        wanderTime: 0,
        wanderPhase: MathUtils.seededRandom() * Math.PI * 2,
        calmHeightRatio,
      });
    }
    this.lake = { fishes, field };

    eventBus.on("engine-render-update", this.onEngineUpdate);
    debugKoi();
  }

  private onEngineUpdate = ({ player, delta }: State) => {
    const { lake } = this;
    for (const fish of lake.fishes) {
      steerFish(fish, lake, player.position, delta);

      const { material, mesh, speed, turnRate } = fish;
      const turnSpeed = Math.max(speed, CRUISE_SPEED);
      const beatRate = CRUISE_BEAT_RATE + speed * BEAT_RATE_PER_SPEED;
      material.uSwimPhase.value += beatRate * delta;
      const effort = MathUtils.clamp(
        (speed - CRUISE_SPEED) / (FLEE_SPEED - CRUISE_SPEED),
        0,
        1,
      );
      material.uSwing.value = MathUtils.lerp(CRUISE_SWING, FLEE_SWING, effort);
      material.uCurvature.value = (turnRate / turnSpeed) * mesh.scale.x;
    }
  };
}

const findSpawnCells = (field: KoiLakeField) => {
  const { columns, rows, values } = field;
  const cellCount = columns * rows;
  const spawnCells: number[] = [];
  for (let attempt = 0; attempt < cellCount; attempt++) {
    const cell = Math.floor(MathUtils.seededRandom() * cellCount);
    const isOpenWater = values[cell * 2] >= SPAWN_CLEARANCE;
    if (!isOpenWater) continue;
    const column = cell % columns;
    const row = Math.floor(cell / columns);
    let isCrowded = false;
    for (const other of spawnCells) {
      const otherColumn = other % columns;
      const otherRow = Math.floor(other / columns);
      const distance =
        Math.hypot(column - otherColumn, row - otherRow) * field.cellSize;
      if (distance >= SPAWN_SPACING) continue;
      isCrowded = true;
      break;
    }
    if (isCrowded) continue;
    spawnCells.push(cell);
    if (spawnCells.length === FISH_COUNT) return spawnCells;
  }
  throw new Error("Not enough open water to spawn every koi");
};
