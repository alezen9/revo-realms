import { CatmullRomCurve3, MathUtils, Mesh, Vector3 } from "three";
import { type State } from "../../Game";
import { assets, eventBus, graphics, stage } from "../../systems";
import { config } from "./KoiConfig";
import { debugKoi } from "./KoiDebug";
import { KoiMaterial } from "./KoiMaterial";

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
    const { koiModel, terrainModel } = assets.resources;
    const { geometry } = assets.getMesh("koi", koiModel);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    if (!bounds) throw new Error("Koi has no bounding box");
    const bodyLength = bounds.max.z - bounds.min.z;

    const paths = assets.getObject("koi-paths", terrainModel);
    paths.updateWorldMatrix(true, true);

    for (const [index, path] of paths.children.entries()) {
      const points = path.children.map((point) =>
        point.getWorldPosition(new Vector3()),
      );
      const route = new CatmullRomCurve3(points, true);
      const coloring =
        assets.resources[config.COLORINGS[index % config.COLORINGS.length]];
      const material = new KoiMaterial(coloring, bounds.max.z, bodyLength);
      const mesh = new Mesh(geometry, material);
      mesh.scale.setScalar(config.SIZES[index % config.SIZES.length]);
      const isEven = index % 2 === 0;
      const direction = isEven ? 1 : -1;
      const routeLength = route.getLength();
      const progress = index / paths.children.length;
      const goalLead = (direction * config.MIN_LOOK_AHEAD) / routeLength;
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
        speed: config.CRUISE_SPEED,
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
        mesh.position.distanceToSquared(player.position) <
        config.FLEE_RADIUS ** 2;
      const isStartled = isPlayerNear && fish.fleeTime === 0;
      fish.fleeTime = isPlayerNear
        ? config.FLEE_DURATION
        : Math.max(0, fish.fleeTime - delta);
      const isFleeing = fish.fleeTime > 0;

      // the fish created first keeps its pace, so two never wait on each other
      let isGivingWay = false;
      for (let otherIndex = 0; otherIndex < index; otherIndex++) {
        const other = this.fishes[otherIndex];
        const otherDistanceSquared = other.mesh.position.distanceToSquared(
          mesh.position,
        );
        const isOtherClose = otherDistanceSquared < config.GIVE_WAY_RADIUS ** 2;
        if (!isOtherClose) continue;
        isGivingWay = true;
        break;
      }

      let targetSpeed = config.CRUISE_SPEED;
      if (isGivingWay) targetSpeed = config.GIVE_WAY_SPEED;
      if (isFleeing) targetSpeed = config.FLEE_SPEED;
      fish.speed = MathUtils.damp(
        fish.speed,
        targetSpeed,
        isFleeing ? config.FLEE_RESPONSE : config.CRUISE_RESPONSE,
        delta,
      );
      const travel = fish.speed * delta;
      const lookAhead = Math.max(config.MIN_LOOK_AHEAD, fish.speed);

      this.heading.set(Math.sin(fish.yaw), 0, Math.cos(fish.yaw));
      this.awayFromPlayer.subVectors(mesh.position, player.position);
      const isFacingPlayer = this.heading.dot(this.awayFromPlayer) < 0;

      route.getPointAt(fish.goalProgress, this.goal);
      // the goal outpaces the fish only while close, so it never runs off without the fish
      const isGoalNear = this.goal.distanceTo(mesh.position) < lookAhead;
      let goalAdvance = 0;
      if (isGoalNear) goalAdvance = config.GOAL_PACE * travel;
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
      const turnSpeed = Math.max(fish.speed, config.CRUISE_SPEED);
      const maxTurnRate = turnSpeed / config.TURN_RADIUS;
      const targetTurnRate = MathUtils.clamp(
        (yawError * turnSpeed) / config.TURN_CORRECTION_DISTANCE,
        -maxTurnRate,
        maxTurnRate,
      );
      fish.turnRate = MathUtils.damp(
        fish.turnRate,
        targetTurnRate,
        turnSpeed / config.TURN_EASE_DISTANCE,
        delta,
      );
      fish.yaw += fish.turnRate * delta;
      mesh.rotation.y = fish.yaw;

      this.heading.set(Math.sin(fish.yaw), 0, Math.cos(fish.yaw));
      mesh.position.addScaledVector(this.heading, travel);
      mesh.position.y = MathUtils.damp(
        mesh.position.y,
        this.goal.y,
        config.DEPTH_RESPONSE,
        delta,
      );
      const beatRate =
        config.CRUISE_BEAT_RATE + fish.speed * config.BEAT_RATE_PER_SPEED;
      material.uSwimPhase.value += beatRate * delta;
      const effort = MathUtils.clamp(
        (fish.speed - config.CRUISE_SPEED) /
          (config.FLEE_SPEED - config.CRUISE_SPEED),
        0,
        1,
      );
      material.uSwing.value = MathUtils.lerp(
        config.CRUISE_SWING,
        config.FLEE_SWING,
        effort,
      );
      material.uCurvature.value = (fish.turnRate / turnSpeed) * mesh.scale.x;
    }
  };
}
