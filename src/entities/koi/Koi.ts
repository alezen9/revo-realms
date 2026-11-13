import { CatmullRomCurve3, MathUtils, Mesh, Vector3 } from "three";
import { type State } from "../../Game";
import { assets, eventBus, graphics, stage } from "../../systems";
import { config } from "./KoiConfig";
import { debugKoi } from "./KoiDebug";
import { KoiMaterial } from "./KoiMaterial";

const {
  COLORINGS,
  SIZES,
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
  CRUISE_BEAT_RATE,
  BEAT_RATE_PER_SPEED,
  CRUISE_SWING,
  FLEE_SWING,
} = config;

type Fish = {
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

export class Koi {
  private fishes: Fish[] = [];
  private heading = new Vector3();
  private goalDirection = new Vector3();
  private goal = new Vector3();
  private awayFromPlayer = new Vector3();

  // the lake scatter keeps rocks off the routes, so koi only ever follow them
  constructor() {
    const { koiModel, koiRoutes } = assets.resources;
    const { geometry } = assets.getMesh("koi", koiModel);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    if (!bounds) throw new Error("Koi has no bounding box");
    const bodyLength = bounds.max.z - bounds.min.z;

    // the first float is the sample count of every route, then x, y, z per sample
    const { buffer, byteOffset, byteLength } = koiRoutes;
    const routeFloats = new Float32Array(buffer, byteOffset, byteLength / 4);
    const [samplesPerRoute] = routeFloats;
    const samples = routeFloats.subarray(1);
    const routeCount = samples.length / (samplesPerRoute * 3);

    for (let index = 0; index < routeCount; index++) {
      const points = Array.from({ length: samplesPerRoute }, (_, sample) =>
        new Vector3().fromArray(
          samples,
          (index * samplesPerRoute + sample) * 3,
        ),
      );
      const route = new CatmullRomCurve3(points, true);
      const coloring = assets.resources[COLORINGS[index % COLORINGS.length]];
      const material = new KoiMaterial(coloring, bounds.max.z, bodyLength);
      const mesh = new Mesh(geometry, material);
      mesh.scale.setScalar(SIZES[index % SIZES.length]);
      const isEven = index % 2 === 0;
      const direction = isEven ? 1 : -1;
      const routeLength = route.getLength();
      const progress = index / routeCount;
      const goalLead = (direction * MIN_LOOK_AHEAD) / routeLength;
      route.getPointAt(progress, mesh.position);
      route.getTangentAt(progress, this.heading).multiplyScalar(direction);
      const yaw = Math.atan2(this.heading.x, this.heading.z);
      mesh.rotation.y = yaw;
      stage.mainScene.add(mesh);
      graphics.vsmPass.registerCaster(mesh, { type: "dynamic" });

      this.fishes.push({
        mesh,
        material,
        route,
        routeLength,
        direction,
        goalProgress: MathUtils.euclideanModulo(progress + goalLead, 1),
        speed: CRUISE_SPEED,
        fleeTime: 0,
        yaw,
        turnRate: 0,
      });
    }

    eventBus.on("engine-render-update", this.onEngineUpdate);
    debugKoi();
  }

  private onEngineUpdate = ({ player, delta }: State) => {
    for (const [index, fish] of this.fishes.entries()) {
      const { mesh, material, route, routeLength } = fish;

      const isPlayerNear =
        mesh.position.distanceToSquared(player.position) < FLEE_RADIUS ** 2;
      const isStartled = isPlayerNear && fish.fleeTime === 0;
      fish.fleeTime = isPlayerNear
        ? FLEE_DURATION
        : Math.max(0, fish.fleeTime - delta);
      const isFleeing = fish.fleeTime > 0;

      // the fish created first keeps its pace, so two never wait on each other
      let isGivingWay = false;
      for (let otherIndex = 0; otherIndex < index; otherIndex++) {
        const other = this.fishes[otherIndex];
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

      this.heading.set(Math.sin(fish.yaw), 0, Math.cos(fish.yaw));
      this.awayFromPlayer.subVectors(mesh.position, player.position);
      const isFacingPlayer = this.heading.dot(this.awayFromPlayer) < 0;

      route.getPointAt(fish.goalProgress, this.goal);
      // the goal outpaces the fish only while close, so it never runs off without the fish
      const isGoalNear = this.goal.distanceTo(mesh.position) < lookAhead;
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

      this.goalDirection
        .subVectors(this.goal, mesh.position)
        .setY(0)
        .normalize();

      // the turn rate eases in and out and is capped by speed, so every change of course is a smooth arc
      const goalYaw = Math.atan2(this.goalDirection.x, this.goalDirection.z);
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

      this.heading.set(Math.sin(fish.yaw), 0, Math.cos(fish.yaw));
      mesh.position.addScaledVector(this.heading, travel);
      mesh.position.y = MathUtils.damp(
        mesh.position.y,
        this.goal.y,
        DEPTH_RESPONSE,
        delta,
      );
      const beatRate = CRUISE_BEAT_RATE + fish.speed * BEAT_RATE_PER_SPEED;
      material.uSwimPhase.value += beatRate * delta;
      const effort = MathUtils.clamp(
        (fish.speed - CRUISE_SPEED) / (FLEE_SPEED - CRUISE_SPEED),
        0,
        1,
      );
      material.uSwing.value = MathUtils.lerp(CRUISE_SWING, FLEE_SWING, effort);
      material.uCurvature.value = (fish.turnRate / turnSpeed) * mesh.scale.x;
    }
  };
}
