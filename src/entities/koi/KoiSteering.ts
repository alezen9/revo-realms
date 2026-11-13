import { CatmullRomCurve3, MathUtils, type Mesh, Vector3 } from "three";
import { config } from "./KoiConfig";
import type { KoiMaterial } from "./KoiMaterial";

const {
  MIN_LOOK_AHEAD,
  CRUISE_SPEED,
  RETURN_SPEED,
  FLEE_RADIUS,
  FLEE_DURATION,
  GIVE_WAY_RADIUS,
  GIVE_WAY_SPEED,
  FLEE_SPEED,
  FLEE_RESPONSE,
  CRUISE_RESPONSE,
  GOAL_PACE,
  TURN_RADIUS,
  TURN_CORRECTION_DISTANCE,
  TURN_EASE_DISTANCE,
  DEPTH_RESPONSE,
  SEPARATION_RADIUS,
  SEPARATION_STRENGTH,
  AVOID_DISTANCE,
  AVOID_DISTANCE_PER_SPEED,
  AVOID_STRENGTH,
  DEPTH_LOOK_AHEAD,
  LINE_MARGIN,
  MIN_AVOID_DISTANCE,
  RETURN_TIMEOUT,
} = config;

export type KoiRoute = {
  curve: CatmullRomCurve3;
  length: number;
  samples: Vector3[];
  // field cell to the route sample that falls in it, where a path search can reach the route
  cells: Map<number, number>;
};

// cells run row by row along x, each holds the signed distance to the nearest
// rock or water too shallow to swim, then the height a fleeing koi dives to
export type KoiLakeField = {
  originX: number;
  originZ: number;
  cellSize: number;
  columns: number;
  rows: number;
  values: Float32Array;
};

type KoiMode = "route" | "flee" | "return";

export type Fish = {
  mesh: Mesh;
  material: KoiMaterial;
  mode: KoiMode;
  routeIndex: number;
  direction: number;
  goalProgress: number;
  speed: number;
  fleeTime: number;
  returnTime: number;
  path: Vector3[];
  pathIndex: number;
  yaw: number;
  turnRate: number;
};

export type KoiLake = {
  fishes: Fish[];
  routes: KoiRoute[];
  // the fish swimming each route, or -1 while it is free
  routeOwners: number[];
  field: KoiLakeField;
};

const DISTANCE_CHANNEL = 0;
const FLEE_HEIGHT_CHANNEL = 1;

const heading = new Vector3();
const desired = new Vector3();
const goal = new Vector3();
const away = new Vector3();
const fieldGradient = new Vector3();
const routeTangent = new Vector3();
const ahead = new Vector3();

const sampleLakeField = (
  field: KoiLakeField,
  x: number,
  z: number,
  channel: number,
) => {
  const { originX, originZ, cellSize, columns, rows, values } = field;
  const gridX = MathUtils.clamp((x - originX) / cellSize, 0, columns - 1.0001);
  const gridZ = MathUtils.clamp((z - originZ) / cellSize, 0, rows - 1.0001);
  const column = Math.floor(gridX);
  const row = Math.floor(gridZ);
  const index = (row * columns + column) * 2 + channel;
  const rowStride = columns * 2;
  const near = MathUtils.lerp(values[index], values[index + 2], gridX - column);
  const far = MathUtils.lerp(
    values[index + rowStride],
    values[index + rowStride + 2],
    gridX - column,
  );
  return MathUtils.lerp(near, far, gridZ - row);
};

const getFieldGradient = (field: KoiLakeField, position: Vector3) => {
  const { cellSize } = field;
  const step = cellSize / 2;
  const { x, z } = position;
  const left = sampleLakeField(field, x - step, z, DISTANCE_CHANNEL);
  const right = sampleLakeField(field, x + step, z, DISTANCE_CHANNEL);
  const back = sampleLakeField(field, x, z - step, DISTANCE_CHANNEL);
  const front = sampleLakeField(field, x, z + step, DISTANCE_CHANNEL);
  return fieldGradient.set(right - left, 0, front - back).normalize();
};

// a returning koi starts avoiding this far off, so a straight line has to keep that clear
const RETURN_AVOID_DISTANCE =
  AVOID_DISTANCE + RETURN_SPEED * AVOID_DISTANCE_PER_SPEED;

const isLineClear = (field: KoiLakeField, from: Vector3, to: Vector3) => {
  const targetDistance = sampleLakeField(field, to.x, to.z, DISTANCE_CHANNEL);
  const avoidDistance = Math.min(RETURN_AVOID_DISTANCE, targetDistance);
  const clearance = Math.max(MIN_AVOID_DISTANCE, avoidDistance) - LINE_MARGIN;
  const steps = Math.ceil(from.distanceTo(to) / (field.cellSize / 2));
  for (let step = 1; step <= steps; step++) {
    const ratio = step / steps;
    const x = MathUtils.lerp(from.x, to.x, ratio);
    const z = MathUtils.lerp(from.z, to.z, ratio);
    const distance = sampleLakeField(field, x, z, DISTANCE_CHANNEL);
    if (distance < clearance) return false;
  }
  return true;
};

const getCellIndex = (field: KoiLakeField, x: number, z: number) => {
  const { originX, originZ, cellSize, columns, rows } = field;
  const column = MathUtils.clamp(
    Math.round((x - originX) / cellSize),
    0,
    columns - 1,
  );
  const row = MathUtils.clamp(
    Math.round((z - originZ) / cellSize),
    0,
    rows - 1,
  );
  return row * columns + column;
};

export const getRouteCells = (samples: Vector3[], field: KoiLakeField) => {
  const cells = new Map<number, number>();
  for (const [sample, point] of samples.entries()) {
    const cell = getCellIndex(field, point.x, point.z);
    if (!cells.has(cell)) cells.set(cell, sample);
  }
  return cells;
};

const NEIGHBOR_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
let searchParents = new Int32Array(0);
let searchQueue = new Int32Array(0);

// breadth first over the field cells a koi can swim, so the nearest free route
// is the nearest by water and never one behind a rock or the shore
const findPathToFreeRoute = (
  field: KoiLakeField,
  lake: KoiLake,
  from: Vector3,
) => {
  const { routes, routeOwners } = lake;
  const { originX, originZ, cellSize, columns, rows, values } = field;
  const cellCount = columns * rows;
  if (searchParents.length !== cellCount) {
    searchParents = new Int32Array(cellCount);
    searchQueue = new Int32Array(cellCount);
  }
  searchParents.fill(-1);
  const start = getCellIndex(field, from.x, from.z);
  searchParents[start] = start;
  searchQueue[0] = start;
  let head = 0;
  let tail = 1;
  while (head < tail) {
    const cell = searchQueue[head++];
    for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
      const isTaken = routeOwners[routeIndex] !== -1;
      if (isTaken) continue;
      const sample = routes[routeIndex].cells.get(cell);
      if (sample === undefined) continue;
      const path: Vector3[] = [];
      for (
        let pathCell = cell;
        pathCell !== start;
        pathCell = searchParents[pathCell]
      ) {
        const column = pathCell % columns;
        const row = Math.floor(pathCell / columns);
        path.push(
          new Vector3(originX + column * cellSize, 0, originZ + row * cellSize),
        );
      }
      return { routeIndex, sample, path: path.reverse() };
    }
    const column = cell % columns;
    const row = Math.floor(cell / columns);
    for (const [columnOffset, rowOffset] of NEIGHBOR_OFFSETS) {
      const nextColumn = column + columnOffset;
      const nextRow = row + rowOffset;
      const isInside =
        nextColumn >= 0 &&
        nextColumn < columns &&
        nextRow >= 0 &&
        nextRow < rows;
      if (!isInside) continue;
      const next = nextRow * columns + nextColumn;
      const isVisited = searchParents[next] !== -1;
      const isSwimmable = values[next * 2] >= MIN_AVOID_DISTANCE;
      if (isVisited || !isSwimmable) continue;
      searchParents[next] = cell;
      searchQueue[tail++] = next;
    }
  }
  return null;
};

const findNearestFreeRoute = (lake: KoiLake, from: Vector3) => {
  const { routes, routeOwners } = lake;
  let best = { routeIndex: -1, sample: 0, path: [] as Vector3[] };
  let bestDistance = Infinity;
  for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
    const isTaken = routeOwners[routeIndex] !== -1;
    if (isTaken) continue;
    for (const [sample, point] of routes[routeIndex].samples.entries()) {
      const distance = point.distanceToSquared(from);
      if (distance >= bestDistance) continue;
      bestDistance = distance;
      best = { routeIndex, sample, path: [] };
    }
  }
  return best;
};

const joinNearestFreeRoute = (fish: Fish, index: number, lake: KoiLake) => {
  const { routes, routeOwners, field } = lake;
  const { position } = fish.mesh;
  // a koi pushed into a pocket with no swimmable neighbour still needs a way home
  const found =
    findPathToFreeRoute(field, lake, position) ??
    findNearestFreeRoute(lake, position);
  const { routeIndex, sample, path } = found;
  if (routeIndex === -1) return;

  const { samples, length } = routes[routeIndex];
  const nextSample = samples[(sample + 1) % samples.length];
  routeTangent.subVectors(nextSample, samples[sample]);
  heading.set(Math.sin(fish.yaw), 0, Math.cos(fish.yaw));
  const direction = routeTangent.dot(heading) >= 0 ? 1 : -1;
  const progress = sample / samples.length;
  const goalLead = (direction * MIN_LOOK_AHEAD) / length;
  routeOwners[routeIndex] = index;
  fish.routeIndex = routeIndex;
  fish.direction = direction;
  fish.goalProgress = MathUtils.euclideanModulo(progress + goalLead, 1);
  fish.path = path;
  fish.pathIndex = 0;
  fish.mode = "return";
  fish.returnTime = 0;
};

export const steerFish = (
  fish: Fish,
  index: number,
  lake: KoiLake,
  playerPosition: Vector3,
  delta: number,
) => {
  const { mesh } = fish;
  const { position } = mesh;
  const { fishes, routes, routeOwners, field } = lake;

  const isPlayerNear =
    position.distanceToSquared(playerPosition) < FLEE_RADIUS ** 2;
  fish.fleeTime = isPlayerNear
    ? FLEE_DURATION
    : Math.max(0, fish.fleeTime - delta);
  const isStartled = isPlayerNear && fish.mode !== "flee";
  if (isStartled) {
    const isOwnRoute = routeOwners[fish.routeIndex] === index;
    if (isOwnRoute) routeOwners[fish.routeIndex] = -1;
    fish.mode = "flee";
  }
  const isCalmAgain = fish.mode === "flee" && fish.fleeTime === 0;
  if (isCalmAgain) joinNearestFreeRoute(fish, index, lake);
  if (fish.mode === "return") fish.returnTime += delta;
  // steering fields can still trap a koi, so a return that drags on picks again from where it is
  const isReturnStuck =
    fish.mode === "return" && fish.returnTime > RETURN_TIMEOUT;
  if (isReturnStuck) {
    routeOwners[fish.routeIndex] = -1;
    joinNearestFreeRoute(fish, index, lake);
  }

  const isFleeing = fish.mode === "flee";
  const isReturning = fish.mode === "return";

  // the fish created first keeps its pace, so two never wait on each other
  let isGivingWay = false;
  for (let otherIndex = 0; otherIndex < index; otherIndex++) {
    const other = fishes[otherIndex];
    const otherDistanceSquared =
      other.mesh.position.distanceToSquared(position);
    const isOtherClose = otherDistanceSquared < GIVE_WAY_RADIUS ** 2;
    if (!isOtherClose) continue;
    isGivingWay = true;
    break;
  }

  let targetSpeed = CRUISE_SPEED;
  if (isGivingWay) targetSpeed = GIVE_WAY_SPEED;
  if (isReturning) targetSpeed = RETURN_SPEED;
  if (isFleeing) targetSpeed = FLEE_SPEED;
  fish.speed = MathUtils.damp(
    fish.speed,
    targetSpeed,
    isFleeing || isReturning ? FLEE_RESPONSE : CRUISE_RESPONSE,
    delta,
  );
  const travel = fish.speed * delta;
  const lookAhead = Math.max(MIN_LOOK_AHEAD, fish.speed);

  heading.set(Math.sin(fish.yaw), 0, Math.cos(fish.yaw));
  ahead.copy(position).addScaledVector(heading, fish.speed * DEPTH_LOOK_AHEAD);
  // depth eases in, so the bed is read ahead as well or a fast koi would scrape a rising one
  const fleeHeight = Math.max(
    sampleLakeField(field, position.x, position.z, FLEE_HEIGHT_CHANNEL),
    sampleLakeField(field, ahead.x, ahead.z, FLEE_HEIGHT_CHANNEL),
  );

  let targetHeight = fleeHeight;
  if (isFleeing) {
    desired.subVectors(position, playerPosition).setY(0).normalize();
  } else {
    const { curve, length } = routes[fish.routeIndex];
    curve.getPointAt(fish.goalProgress, goal);
    targetHeight = isReturning ? Math.max(goal.y, fleeHeight) : goal.y;

    const { path } = fish;
    while (isReturning && fish.pathIndex < path.length - 1) {
      const waypoint = path[fish.pathIndex];
      const waypointDistance = Math.hypot(
        waypoint.x - position.x,
        waypoint.z - position.z,
      );
      const isReached = waypointDistance < field.cellSize;
      const canSkip = isLineClear(field, position, path[fish.pathIndex + 1]);
      if (!isReached && !canSkip) break;
      fish.pathIndex++;
    }
    const isFollowingPath = isReturning && fish.pathIndex < path.length - 1;

    if (isFollowingPath) {
      desired.subVectors(path[fish.pathIndex], position).setY(0).normalize();
    } else {
      // the goal outpaces the fish only while close, so it never runs off without the fish
      const goalDistance = goal.distanceTo(position);
      const isGoalNear = goalDistance < lookAhead;
      const isBackOnRoute = isReturning && goalDistance < MIN_LOOK_AHEAD;
      if (isBackOnRoute) fish.mode = "route";
      const goalAdvance = isGoalNear ? GOAL_PACE * travel : 0;
      fish.goalProgress = MathUtils.euclideanModulo(
        fish.goalProgress + (fish.direction * goalAdvance) / length,
        1,
      );
      desired.subVectors(goal, position).setY(0).normalize();
    }
  }

  for (const other of fishes) {
    if (other === fish) continue;
    away.subVectors(position, other.mesh.position).setY(0);
    const distance = away.length();
    const isClose = distance < SEPARATION_RADIUS && distance > 0;
    if (!isClose) continue;
    const push = (1 - distance / SEPARATION_RADIUS) * SEPARATION_STRENGTH;
    desired.addScaledVector(away, push / distance);
  }

  // routes are kept clear of rocks, so only a koi off its route steers around them
  const isOffRoute = fish.mode !== "route";
  if (isOffRoute) {
    const obstacleDistance = sampleLakeField(
      field,
      position.x,
      position.z,
      DISTANCE_CHANNEL,
    );
    const speedAvoidDistance =
      AVOID_DISTANCE + fish.speed * AVOID_DISTANCE_PER_SPEED;
    // a returning koi trusts its route, so it never keeps farther off than the goal does
    const goalObstacleDistance = isReturning
      ? sampleLakeField(field, goal.x, goal.z, DISTANCE_CHANNEL)
      : Infinity;
    const avoidDistance = Math.max(
      MIN_AVOID_DISTANCE,
      Math.min(speedAvoidDistance, goalObstacleDistance),
    );
    const isNearObstacle = obstacleDistance < avoidDistance;
    if (isNearObstacle) {
      const gradient = getFieldGradient(field, position);
      const closeness = MathUtils.clamp(
        1 - obstacleDistance / avoidDistance,
        0,
        1,
      );
      desired.normalize();
      // the part heading into the obstacle fades as it nears, so the koi slides along it
      const into = Math.min(0, desired.dot(gradient));
      desired.addScaledVector(gradient, -into * Math.min(1, closeness * 2));
      desired.addScaledVector(gradient, closeness * AVOID_STRENGTH);
    }
  }
  desired.normalize();

  // the turn rate eases in and out and is capped by speed, so every change of course is a smooth arc
  const desiredYaw = Math.atan2(desired.x, desired.z);
  const yawError =
    MathUtils.euclideanModulo(desiredYaw - fish.yaw + Math.PI, Math.PI * 2) -
    Math.PI;
  const turnSpeed = Math.max(fish.speed, CRUISE_SPEED);
  const maxTurnRate = turnSpeed / TURN_RADIUS;
  const targetTurnRate = MathUtils.clamp(
    (yawError * turnSpeed) / TURN_CORRECTION_DISTANCE,
    -maxTurnRate,
    maxTurnRate,
  );
  fish.turnRate = MathUtils.damp(
    fish.turnRate,
    targetTurnRate,
    turnSpeed / TURN_EASE_DISTANCE,
    delta,
  );
  fish.yaw += fish.turnRate * delta;
  mesh.rotation.y = fish.yaw;

  heading.set(Math.sin(fish.yaw), 0, Math.cos(fish.yaw));
  position.addScaledVector(heading, travel);
  position.y = MathUtils.damp(position.y, targetHeight, DEPTH_RESPONSE, delta);
};
