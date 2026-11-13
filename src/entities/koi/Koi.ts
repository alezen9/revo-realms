import { CatmullRomCurve3, MathUtils, Mesh, Vector3 } from "three";
import { type State } from "../../Game";
import { assets, eventBus, graphics, stage } from "../../systems";
import { config } from "./KoiConfig";
import { debugKoi } from "./KoiDebug";
import { KoiMaterial } from "./KoiMaterial";
import {
  getRouteCells,
  steerFish,
  type Fish,
  type KoiLake,
  type KoiRoute,
} from "./KoiSteering";

const {
  COLORINGS,
  SIZES,
  MIN_LOOK_AHEAD,
  CRUISE_SPEED,
  FLEE_SPEED,
  CRUISE_BEAT_RATE,
  BEAT_RATE_PER_SPEED,
  CRUISE_SWING,
  FLEE_SWING,
} = config;

export class Koi {
  private lake: KoiLake;

  constructor() {
    const { koiModel, koiRoutes, koiLakeField } = assets.resources;
    const { geometry } = assets.getMesh("koi", koiModel);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    if (!bounds) throw new Error("Koi has no bounding box");
    const bodyLength = bounds.max.z - bounds.min.z;

    // the header holds the grid origin, cell size, columns and rows
    const fieldFloats = new Float32Array(
      koiLakeField.buffer,
      koiLakeField.byteOffset,
      koiLakeField.byteLength / 4,
    );
    const [originX, originZ, cellSize, columns, rows] = fieldFloats;
    const field = {
      originX,
      originZ,
      cellSize,
      columns,
      rows,
      values: fieldFloats.subarray(5),
    };

    // the first float is the sample count of every route, then x, y, z per sample
    const { buffer, byteOffset, byteLength } = koiRoutes;
    const routeFloats = new Float32Array(buffer, byteOffset, byteLength / 4);
    const [samplesPerRoute] = routeFloats;
    const samples = routeFloats.subarray(1);
    const routeCount = samples.length / (samplesPerRoute * 3);

    const routes: KoiRoute[] = [];
    const fishes: Fish[] = [];
    for (let index = 0; index < routeCount; index++) {
      const points = Array.from({ length: samplesPerRoute }, (_, sample) =>
        new Vector3().fromArray(
          samples,
          (index * samplesPerRoute + sample) * 3,
        ),
      );
      const route = new CatmullRomCurve3(points, true);
      const routeLength = route.getLength();
      routes.push({
        curve: route,
        length: routeLength,
        samples: points,
        cells: getRouteCells(points, field),
      });
      const coloring = assets.resources[COLORINGS[index % COLORINGS.length]];
      const material = new KoiMaterial(coloring, bounds.max.z, bodyLength);
      const mesh = new Mesh(geometry, material);
      mesh.scale.setScalar(SIZES[index % SIZES.length]);
      const isEven = index % 2 === 0;
      const direction = isEven ? 1 : -1;
      const progress = index / routeCount;
      const goalLead = (direction * MIN_LOOK_AHEAD) / routeLength;
      route.getPointAt(progress, mesh.position);
      const heading = route.getTangentAt(progress).multiplyScalar(direction);
      const yaw = Math.atan2(heading.x, heading.z);
      mesh.rotation.y = yaw;
      stage.mainScene.add(mesh);
      graphics.vsmPass.registerCaster(mesh, { type: "dynamic" });

      fishes.push({
        mesh,
        material,
        mode: "route",
        routeIndex: index,
        direction,
        goalProgress: MathUtils.euclideanModulo(progress + goalLead, 1),
        speed: CRUISE_SPEED,
        fleeTime: 0,
        returnTime: 0,
        path: [],
        pathIndex: 0,
        yaw,
        turnRate: 0,
      });
    }

    const routeOwners = routes.map((_, index) => index);
    this.lake = { fishes, routes, routeOwners, field };

    eventBus.on("engine-render-update", this.onEngineUpdate);
    debugKoi();
  }

  private onEngineUpdate = ({ player, delta }: State) => {
    const { lake } = this;
    for (const [index, fish] of lake.fishes.entries()) {
      steerFish(fish, index, lake, player.position, delta);

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
