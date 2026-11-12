import {
  CatmullRomCurve3,
  MathUtils,
  Mesh,
  Vector3,
  type Texture,
} from "three";
import {
  float,
  positionLocal,
  sin,
  texture,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import { type State } from "../../Game";
import { assets, debugPanel, eventBus, graphics, stage } from "../../systems";
import { VSMReceiverLambertMaterial } from "../../systems/vsm/VSMReceiverMaterials";

const CRUISE_SPEED = 0.5;
const GIVE_WAY_SPEED = 0.12;
const FLEE_SPEED = 6;
const CRUISE_RESPONSE = 0.8;
const FLEE_RESPONSE = 2.5;
const FLEE_DURATION = 3;
const TURN_RADIUS = 1.2;
// turning is measured per meter swum, so a fleeing fish draws the same smooth curve as a cruising one
const TURN_CORRECTION_DISTANCE = 0.33;
const TURN_EASE_DISTANCE = 0.125;
// twice the turn radius, or a fish could circle a goal that sits inside its turn
const MIN_LOOK_AHEAD = 2.5;
const GOAL_PACE = 2;
const DEPTH_RESPONSE = 2;
const FLEE_RADIUS = 6;
const GIVE_WAY_RADIUS = 4;
const CRUISE_BEAT_RATE = 2.5;
const BEAT_RATE_PER_SPEED = 2;
const BODY_WAVE = 3.5;
const CRUISE_SWING = 0.07;
const FLEE_SWING = 0.12;
const SIZES = [2.3, 2.65, 3, 1.6, 1.95];
const COLORINGS = [
  "koiRedWhiteDiffuse",
  "koiRedBlackDiffuse",
  "koiGoldDiffuse",
] as const;

const uniforms = {
  uDiffuseScale: uniform(2.5),
};

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

class KoiMaterial extends VSMReceiverLambertMaterial {
  readonly uSwimPhase = uniform(0);
  readonly uSwing = uniform(CRUISE_SWING);
  readonly uCurvature = uniform(0);

  constructor(coloring: Texture, headZ: number, bodyLength: number) {
    super();
    const diffuse = texture(coloring, uv());
    this.colorNode = diffuse.rgb.mul(uniforms.uDiffuseScale);

    const tailward = float(headZ).sub(positionLocal.z).div(bodyLength);
    const swing = sin(this.uSwimPhase.sub(tailward.mul(BODY_WAVE)))
      .mul(tailward.mul(tailward))
      .mul(this.uSwing);
    // the body lies on the arc through its origin, so it sags toward the turn by distance squared over twice the radius
    const bend = positionLocal.z
      .mul(positionLocal.z)
      .mul(this.uCurvature)
      .mul(0.5);
    this.positionNode = positionLocal.add(vec3(swing.add(bend), 0, 0));
  }
}

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
      const coloring = assets.resources[COLORINGS[index % COLORINGS.length]];
      const material = new KoiMaterial(coloring, bounds.max.z, bodyLength);
      const mesh = new Mesh(geometry, material);
      mesh.scale.setScalar(SIZES[index % SIZES.length]);
      const isEven = index % 2 === 0;
      const direction = isEven ? 1 : -1;
      const routeLength = route.getLength();
      const progress = index / paths.children.length;
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
    this.debug();
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

  private debug() {
    const folder = debugPanel.panel.addFolder({
      title: "🐟 Koi",
      expanded: false,
    });
    folder.addBinding(uniforms.uDiffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
    });
  }
}
