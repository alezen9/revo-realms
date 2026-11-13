import { CatmullRomCurve3, MathUtils, type Mesh, Vector3 } from "three";
import { config } from "./KoiConfig";
import type { KoiMaterial } from "./KoiMaterial";

const {
  MIN_LOOK_AHEAD,
  CRUISE_SPEED,
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
} = config;

export type Fish = {
  mesh: Mesh;
  material: KoiMaterial;
  route: CatmullRomCurve3;
  routeLength: number;
  direction: number;
  goalProgress: number;
  speed: number;
  fleeTime: number;
  yaw: number;
  turnRate: number;
};

const heading = new Vector3();
const goalDirection = new Vector3();
const goal = new Vector3();
const awayFromPlayer = new Vector3();

export const steerFish = (
  fish: Fish,
  index: number,
  fishes: Fish[],
  playerPosition: Vector3,
  delta: number,
) => {
  const { mesh, route, routeLength } = fish;

  const isPlayerNear =
    mesh.position.distanceToSquared(playerPosition) < FLEE_RADIUS ** 2;
  const isStartled = isPlayerNear && fish.fleeTime === 0;
  fish.fleeTime = isPlayerNear
    ? FLEE_DURATION
    : Math.max(0, fish.fleeTime - delta);
  const isFleeing = fish.fleeTime > 0;

  // the fish created first keeps its pace, so two never wait on each other
  let isGivingWay = false;
  for (let otherIndex = 0; otherIndex < index; otherIndex++) {
    const other = fishes[otherIndex];
    const otherDistanceSquared = other.mesh.position.distanceToSquared(
      mesh.position,
    );
    const isOtherClose = otherDistanceSquared < GIVE_WAY_RADIUS ** 2;
    if (!isOtherClose) continue;
    isGivingWay = true;
    break;
  }

  let targetSpeed = CRUISE_SPEED;
  if (isGivingWay) targetSpeed = GIVE_WAY_SPEED;
  if (isFleeing) targetSpeed = FLEE_SPEED;
  fish.speed = MathUtils.damp(
    fish.speed,
    targetSpeed,
    isFleeing ? FLEE_RESPONSE : CRUISE_RESPONSE,
    delta,
  );
  const travel = fish.speed * delta;
  const lookAhead = Math.max(MIN_LOOK_AHEAD, fish.speed);

  heading.set(Math.sin(fish.yaw), 0, Math.cos(fish.yaw));
  awayFromPlayer.subVectors(mesh.position, playerPosition);
  const isFacingPlayer = heading.dot(awayFromPlayer) < 0;

  route.getPointAt(fish.goalProgress, goal);
  // the goal outpaces the fish only while close, so it never runs off without the fish
  const isGoalNear = goal.distanceTo(mesh.position) < lookAhead;
  let goalAdvance = 0;
  if (isGoalNear) goalAdvance = GOAL_PACE * travel;
  if (isStartled && isFacingPlayer) {
    fish.direction *= -1;
    // the goal was a look ahead in front, this drops it as far behind
    goalAdvance = 2 * lookAhead;
  }
  fish.goalProgress = MathUtils.euclideanModulo(
    fish.goalProgress + (fish.direction * goalAdvance) / routeLength,
    1,
  );

  goalDirection.subVectors(goal, mesh.position).setY(0).normalize();

  // the turn rate eases in and out and is capped by speed, so every change of course is a smooth arc
  const goalYaw = Math.atan2(goalDirection.x, goalDirection.z);
  const yawError =
    MathUtils.euclideanModulo(goalYaw - fish.yaw + Math.PI, Math.PI * 2) -
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
  mesh.position.addScaledVector(heading, travel);
  mesh.position.y = MathUtils.damp(
    mesh.position.y,
    goal.y,
    DEPTH_RESPONSE,
    delta,
  );
};
