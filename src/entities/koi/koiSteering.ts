import { MathUtils, type Mesh, Vector3 } from "three";
import { config } from "./koiConfig";
import type { KoiMaterial } from "./KoiMaterial";

const {
  CRUISE_SPEED,
  FLEE_SPEED,
  CRUISE_RESPONSE,
  FLEE_RESPONSE,
  FLEE_RADIUS,
  FLEE_DURATION,
  TURN_RADIUS,
  TURN_CORRECTION_DISTANCE,
  TURN_EASE_DISTANCE,
  WANDER_TURN,
  WANDER_RATE,
  FLEE_WANDER_WEIGHT,
  FLEE_FADE_RADII,
  SEPARATION_RADIUS,
  SEPARATION_STRENGTH,
  SEPARATION_DEPTH_PUSH,
  AVOID_DISTANCE,
  AVOID_DISTANCE_PER_SPEED,
  AVOID_STRENGTH,
  DEPTH_RESPONSE,
  DEPTH_LOOK_AHEAD,
} = config;

const DISTANCE_CHANNEL = 0;
const FLOOR_CHANNEL = 1;

const heading = new Vector3();
const steering = new Vector3();
const awayFromPlayer = new Vector3();
const awayFromFish = new Vector3();
const ahead = new Vector3();
const gradientSample = new Vector3();
const fieldGradient = new Vector3();

// cells run row by row along x, each holds the signed distance to the nearest
// rock or water too shallow to swim, then the lowest height a koi swims at
export type KoiLakeField = {
  originX: number;
  originZ: number;
  cellSize: number;
  columns: number;
  rows: number;
  swimCeiling: number;
  values: Float32Array;
};

export type Fish = {
  mesh: Mesh;
  material: KoiMaterial;
  speed: number;
  yaw: number;
  turnRate: number;
  fleeTime: number;
  wanderTime: number;
  wanderPhase: number;
  calmHeightRatio: number;
};

export type KoiLake = {
  fishes: Fish[];
  field: KoiLakeField;
};

export const steerFish = (
  fish: Fish,
  lake: KoiLake,
  playerPosition: Vector3,
  delta: number,
) => {
  const { mesh } = fish;
  const { position } = mesh;
  const { fishes, field } = lake;

  const isPlayerNear =
    position.distanceToSquared(playerPosition) < FLEE_RADIUS ** 2;
  fish.fleeTime = isPlayerNear
    ? FLEE_DURATION
    : Math.max(0, fish.fleeTime - delta);
  const isFleeing = fish.fleeTime > 0;
  const fleeRemaining = fish.fleeTime / FLEE_DURATION;
  fish.speed = MathUtils.damp(
    fish.speed,
    MathUtils.lerp(CRUISE_SPEED, FLEE_SPEED, fleeRemaining),
    isFleeing ? FLEE_RESPONSE : CRUISE_RESPONSE,
    delta,
  );

  fish.wanderTime += delta;
  const wanderAngle = fish.wanderTime * WANDER_RATE + fish.wanderPhase;
  const wanderBend =
    Math.sin(wanderAngle) + 0.6 * Math.sin(wanderAngle * 0.37 + 2);
  const wanderYaw = fish.yaw + WANDER_TURN * wanderBend;
  steering.set(Math.sin(wanderYaw), 0, Math.cos(wanderYaw));

  if (isFleeing) {
    awayFromPlayer.subVectors(position, playerPosition).setY(0);
    const threat = MathUtils.clamp(
      1 - awayFromPlayer.length() / (FLEE_RADIUS * FLEE_FADE_RADII),
      0,
      1,
    );
    steering
      .multiplyScalar(FLEE_WANDER_WEIGHT)
      .addScaledVector(awayFromPlayer.normalize(), threat);
  }

  let depthSeparation = 0;
  for (const other of fishes) {
    if (other === fish) continue;
    awayFromFish.subVectors(position, other.mesh.position);
    const distance = awayFromFish.length();
    const isClose = distance < SEPARATION_RADIUS && distance > 0;
    if (!isClose) continue;
    const separationWeight = (1 - distance / SEPARATION_RADIUS) / distance;
    depthSeparation +=
      awayFromFish.y * separationWeight * SEPARATION_DEPTH_PUSH;
    awayFromFish.setY(0);
    steering.addScaledVector(
      awayFromFish,
      separationWeight * SEPARATION_STRENGTH,
    );
  }

  const avoidDistance = AVOID_DISTANCE + fish.speed * AVOID_DISTANCE_PER_SPEED;
  const obstacleDistance = sampleLakeField(field, position, DISTANCE_CHANNEL);
  const closeness = MathUtils.clamp(1 - obstacleDistance / avoidDistance, 0, 1);
  const isNearObstacle = closeness > 0;
  if (isNearObstacle) {
    const gradient = getFieldGradient(field, position);
    const avoidWeight = closeness * closeness;
    steering.normalize();
    const intoObstacle = Math.min(0, steering.dot(gradient));
    steering.addScaledVector(
      gradient,
      -intoObstacle * Math.min(1, avoidWeight * 2),
    );
    steering.addScaledVector(gradient, avoidWeight * AVOID_STRENGTH);
  }
  steering.normalize();

  const steeringYaw = Math.atan2(steering.x, steering.z);
  const yawToSteering =
    MathUtils.euclideanModulo(steeringYaw - fish.yaw + Math.PI, Math.PI * 2) -
    Math.PI;
  const isSteeringBehind = Math.abs(yawToSteering) > Math.PI * 0.85;
  const turnSide = Math.sign(fish.turnRate) || 1;
  const yawError = isSteeringBehind
    ? turnSide * Math.abs(yawToSteering)
    : yawToSteering;
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
  position.addScaledVector(heading, fish.speed * delta);

  ahead.copy(position).addScaledVector(heading, fish.speed * DEPTH_LOOK_AHEAD);
  const swimFloor = Math.max(
    sampleLakeField(field, position, FLOOR_CHANNEL),
    sampleLakeField(field, ahead, FLOOR_CHANNEL),
  );
  const calmHeight = MathUtils.lerp(
    swimFloor,
    field.swimCeiling,
    fish.calmHeightRatio,
  );
  const preferredHeight = isFleeing ? swimFloor : calmHeight;
  const targetHeight = MathUtils.clamp(
    preferredHeight + depthSeparation,
    swimFloor,
    field.swimCeiling,
  );
  position.y = MathUtils.damp(position.y, targetHeight, DEPTH_RESPONSE, delta);
};

const sampleLakeField = (
  field: KoiLakeField,
  point: Vector3,
  channel: number,
) => {
  const { originX, originZ, cellSize, columns, rows, values } = field;
  const gridX = MathUtils.clamp(
    (point.x - originX) / cellSize,
    0,
    columns - 1.0001,
  );
  const gridZ = MathUtils.clamp(
    (point.z - originZ) / cellSize,
    0,
    rows - 1.0001,
  );
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

const getFieldGradient = (field: KoiLakeField, point: Vector3) => {
  const step = field.cellSize / 2;
  gradientSample.copy(point).setX(point.x - step);
  const left = sampleLakeField(field, gradientSample, DISTANCE_CHANNEL);
  gradientSample.setX(point.x + step);
  const right = sampleLakeField(field, gradientSample, DISTANCE_CHANNEL);
  gradientSample.setX(point.x).setZ(point.z - step);
  const back = sampleLakeField(field, gradientSample, DISTANCE_CHANNEL);
  gradientSample.setZ(point.z + step);
  const front = sampleLakeField(field, gradientSample, DISTANCE_CHANNEL);
  return fieldGradient.set(right - left, 0, front - back).normalize();
};
