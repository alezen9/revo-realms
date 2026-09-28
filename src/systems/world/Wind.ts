import { MathUtils, Vector2, type Vector3 } from "three";
import { uniform } from "three/tsl";
import { type State } from "../../Game";
import type { EventBus } from "../events/EventBus";
import type { Landmark, Landmarks } from "./Landmarks";

type Phase = "idle" | "direction" | "start" | "ramp" | "hold" | "end" | "decay";

const MAX_INTENSITY = 1;
const RAMP_RATE_PER_SECOND = 1.5;
const DECAY_RATE_PER_SECOND = 0.85;
const HOLD_SECONDS = 3;

export class Wind {
  readonly uDirection = uniform(new Vector2(0, -1));
  readonly uIntensityDirectional = uniform(0);

  private phase: Phase = "idle";
  private target?: Landmark;
  private targetArrivalRadiusSquared = 0;
  private targetPositionXZ = new Vector2();
  private playerPositionXZ = new Vector2();
  private hasPlayerPosition = false;
  private toTargetDirection = new Vector2();
  private holdElapsedSeconds = 0;
  private eventBus: EventBus;
  private landmarks: Landmarks;

  constructor(eventBus: EventBus, landmarks: Landmarks) {
    this.eventBus = eventBus;
    this.landmarks = landmarks;
    this.eventBus.on("swipe-up", this.onSwipeUp);
    this.eventBus.on("engine-render-update-throttle-4x", this.onEngineUpdate);
  }

  activateLandmark = (landmarkId: string) => {
    const landmark = this.landmarks.getById(landmarkId);
    if (!landmark) return false;

    const { position, arrivalRadius } = landmark;
    const arrivalRadiusSquared = arrivalRadius * arrivalRadius;
    const isAlreadyThere =
      this.hasPlayerPosition &&
      this.getDistanceSquaredToPlayer(position) <= arrivalRadiusSquared;
    if (isAlreadyThere) return false;

    this.target = landmark;
    this.targetArrivalRadiusSquared = arrivalRadiusSquared;
    this.targetPositionXZ.set(position.x, position.z);
    this.eventBus.emit("wind-target-change", landmarkId);
    return true;
  };

  get activeLandmarkId() {
    if (!this.target) return null;
    return this.target.id;
  }

  private onSwipeUp = () => {
    if (!this.target || this.phase !== "idle") return;
    this.phase = "direction";
  };

  private onEngineUpdate = ({ player, delta }: State) => {
    this.playerPositionXZ.set(player.position.x, player.position.z);
    this.hasPlayerPosition = true;
    this.clearTargetIfReached();

    if (this.phase === "direction") return this.directionPhase();
    if (this.phase === "start") return this.startPhase();
    if (this.phase === "ramp") return this.rampPhase(delta);
    if (this.phase === "hold") return this.holdPhase(delta);
    if (this.phase === "end") return this.endPhase();
    if (this.phase === "decay") return this.decayPhase(delta);
  };

  private directionPhase() {
    if (!this.target) {
      this.phase = "idle";
      return;
    }

    this.toTargetDirection.subVectors(
      this.targetPositionXZ,
      this.playerPositionXZ,
    );
    const isAtTarget =
      this.toTargetDirection.lengthSq() <= this.targetArrivalRadiusSquared;
    if (isAtTarget) {
      this.target = undefined;
      this.phase = "idle";
      this.eventBus.emit("wind-target-change", null);
      return;
    }

    this.uDirection.value.copy(this.toTargetDirection.normalize());
    this.phase = "start";
  }

  private startPhase() {
    this.eventBus.emit("game-wind-start");
    this.phase = "ramp";
  }

  private rampPhase(delta: number) {
    this.uIntensityDirectional.value = MathUtils.clamp(
      this.uIntensityDirectional.value + delta * RAMP_RATE_PER_SECOND,
      0,
      MAX_INTENSITY,
    );
    if (this.uIntensityDirectional.value === MAX_INTENSITY) this.phase = "hold";
  }

  private holdPhase(delta: number) {
    this.holdElapsedSeconds += delta;
    if (this.holdElapsedSeconds < HOLD_SECONDS) return;
    this.phase = "end";
    this.holdElapsedSeconds = 0;
  }

  private endPhase() {
    this.eventBus.emit("game-wind-end");
    this.phase = "decay";
  }

  private decayPhase(delta: number) {
    this.uIntensityDirectional.value = MathUtils.clamp(
      this.uIntensityDirectional.value - delta * DECAY_RATE_PER_SECOND,
      0,
      MAX_INTENSITY,
    );
    if (this.uIntensityDirectional.value === 0) this.phase = "idle";
  }

  private clearTargetIfReached() {
    if (!this.target) return;
    const isAtTarget =
      this.getDistanceSquaredToPlayer(this.target.position) <=
      this.targetArrivalRadiusSquared;
    if (!isAtTarget) return;

    this.target = undefined;
    this.eventBus.emit("wind-target-change", null);
    if (this.phase === "direction") this.phase = "idle";
  }

  private getDistanceSquaredToPlayer(position: Vector3) {
    const dx = position.x - this.playerPositionXZ.x;
    const dz = position.z - this.playerPositionXZ.y;
    return dx * dx + dz * dz;
  }
}
