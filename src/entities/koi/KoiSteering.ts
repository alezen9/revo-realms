import { MathUtils, type Mesh, Vector3 } from "three";
import { config } from "./KoiConfig";
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
  FLEE_WANDER,
  THREAT_REACH,
  SEPARATION_RADIUS,
  SEPARATION_STRENGTH,
  SEPARATION_HEIGHT,
  AVOID_DISTANCE,
  AVOID_DISTANCE_PER_SPEED,
  AVOID_STRENGTH,
  DEPTH_RESPONSE,
  DEPTH_LOOK_AHEAD,
} = config;

const DISTANCE_CHANNEL = 0;
const FLOOR_CHANNEL = 1;

const heading = new Vector3();
const desired = new Vector3();
const away = new Vector3();
const probe = new Vector3();
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
  depthBias: number;
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
  // a startled koi bursts away and coasts back down to cruising over the cool down
  const fleeRemaining = fish.fleeTime / FLEE_DURATION;
  fish.speed = MathUtils.damp(
    fish.speed,
    MathUtils.lerp(CRUISE_SPEED, FLEE_SPEED, fleeRemaining),
    isFleeing ? FLEE_RESPONSE : CRUISE_RESPONSE,
    delta,
  );

  // two waves at unrelated rates never repeat in step, so the bend drifts like a random wander
  fish.wanderTime += delta;
  const wavePhase = fish.wanderTime * WANDER_RATE + fish.wanderPhase;
  const wanderWave = Math.sin(wavePhase) + 0.6 * Math.sin(wavePhase * 0.37 + 2);
  const wanderYaw = fish.yaw + WANDER_TURN * wanderWave;
  desired.set(Math.sin(wanderYaw), 0, Math.cos(wanderYaw));

  if (isFleeing) {
    away.subVectors(position, playerPosition).setY(0);
    // the urge to flee fades with the player's distance, or a koi would keep ramming the shore after the threat left
    const threat = MathUtils.clamp(
      1 - away.length() / (FLEE_RADIUS * THREAT_REACH),
      0,
      1,
    );
    desired
      .multiplyScalar(FLEE_WANDER)
      .addScaledVector(away.normalize(), threat);
  }

  // fish pass over and under each other, so neighbours are kept apart in depth as well
  let heightPush = 0;
  for (const other of fishes) {
    if (other === fish) continue;
    away.subVectors(position, other.mesh.position);
    const distance = away.length();
    const isClose = distance < SEPARATION_RADIUS && distance > 0;
    if (!isClose) continue;
    const push = (1 - distance / SEPARATION_RADIUS) / distance;
    heightPush += away.y * push * SEPARATION_HEIGHT;
    away.setY(0);
    desired.addScaledVector(away, push * SEPARATION_STRENGTH);
  }

  // sampled at the koi itself, so the push never jumps between sample points as it turns
  const avoidDistance = AVOID_DISTANCE + fish.speed * AVOID_DISTANCE_PER_SPEED;
  const obstacleDistance = sampleLakeField(field, position, DISTANCE_CHANNEL);
  const closeness = MathUtils.clamp(1 - obstacleDistance / avoidDistance, 0, 1);
  const isNearObstacle = closeness > 0;
  if (isNearObstacle) {
    const gradient = getFieldGradient(field, position);
    // eased in, so the push starts gently instead of kicking in at full slope
    const avoidWeight = closeness * closeness;
    desired.normalize();
    // the part heading into the obstacle fades as it nears, so the koi slides along it
    const into = Math.min(0, desired.dot(gradient));
    desired.addScaledVector(gradient, -into * Math.min(1, avoidWeight * 2));
    desired.addScaledVector(gradient, avoidWeight * AVOID_STRENGTH);
  }
  desired.normalize();

  // the turn rate eases in and out and is capped by speed, so every change of course is a smooth arc
  const desiredYaw = Math.atan2(desired.x, desired.z);
  const wrappedError =
    MathUtils.euclideanModulo(desiredYaw - fish.yaw + Math.PI, Math.PI * 2) -
    Math.PI;
  // straight behind flips sign every frame and the turn would cancel out, so the koi keeps the side it turns to
  const isBehind = Math.abs(wrappedError) > Math.PI * 0.85;
  const turnSide = Math.sign(fish.turnRate) || 1;
  const yawError = isBehind ? turnSide * Math.abs(wrappedError) : wrappedError;
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

  // depth eases in, so the floor is read ahead as well or a fast koi would scrape a rising bed
  probe.copy(position).addScaledVector(heading, fish.speed * DEPTH_LOOK_AHEAD);
  const swimFloor = Math.max(
    sampleLakeField(field, position, FLOOR_CHANNEL),
    sampleLakeField(field, probe, FLOOR_CHANNEL),
  );
  const calmHeight = MathUtils.lerp(
    swimFloor,
    field.swimCeiling,
    fish.depthBias,
  );
  const preferredHeight = isFleeing ? swimFloor : calmHeight;
  const targetHeight = MathUtils.clamp(
    preferredHeight + heightPush,
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
