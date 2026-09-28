import { MathUtils, Vector2 } from "three";
import { uniform } from "three/tsl";
import { type State } from "../../Game";
import type { EventBus } from "../events/EventBus";
import type { Landmark, Landmarks } from "./Landmarks";

type Phase = "idle" | "direction" | "start" | "ramp" | "hold" | "end" | "decay";

export class Wind {
  // uniforms
  readonly uDirection = uniform(new Vector2(0, -1));
  readonly uIntensityDirectional = uniform(0);

  private phase: Phase = "idle";
  private readonly MAX_INTENSITY = 1;
  private readonly RAMP_RATE = 1.5;
  private readonly DECAY_RATE = 0.85;

  // targets
  private target?: Landmark;
  private targetArrivalRadiusSquared = 0;
  private targetPositionXZ = new Vector2(0, 0);

  private playerPositionXZ = new Vector2(0, 0);
  private hasPlayerPosition = false;
  private toTargetDir = new Vector2(0, 0);

  private HOLD_INTENSITY_TIME_S = 3;
  private accTimer = 0;
  private eventBus: EventBus;
  private landmarks: Landmarks;

  constructor(eventBus: EventBus, landmarks: Landmarks) {
    this.eventBus = eventBus;
    this.landmarks = landmarks;

    this.eventBus.on("swipe-up", this.handleSwipeUp);
    this.eventBus.on(
      "engine-render-update-throttle-4x",
      this.handleWindBlowing,
    );
  }

  private handleSwipeUp = () => {
    if (!this.target || this.phase !== "idle") return;
    this.phase = "direction";
  };

  private directionPhase = () => {
    if (!this.target) {
      this.phase = "idle";
      return;
    }

    this.toTargetDir.subVectors(this.targetPositionXZ, this.playerPositionXZ);
    const lenSq = this.toTargetDir.lengthSq();

    if (lenSq <= this.targetArrivalRadiusSquared) {
      this.target = undefined;
      this.phase = "idle";
      this.eventBus.emit("wind-target-change", null);
      return;
    }

    const invLen = 1 / Math.sqrt(lenSq);
    this.toTargetDir.multiplyScalar(invLen);
    this.uDirection.value.copy(this.toTargetDir);
    this.phase = "start";
  };

  private rampPhase = (delta: number) => {
    this.uIntensityDirectional.value = MathUtils.clamp(
      this.uIntensityDirectional.value + delta * this.RAMP_RATE,
      0,
      this.MAX_INTENSITY,
    );
    if (this.uIntensityDirectional.value === this.MAX_INTENSITY)
      this.phase = "hold";
  };

  private holdPhase = (delta: number) => {
    this.accTimer += delta;
    if (this.accTimer < this.HOLD_INTENSITY_TIME_S) return;
    this.phase = "end";
    this.accTimer = 0;
  };

  private decayPhase = (delta: number) => {
    this.uIntensityDirectional.value = MathUtils.clamp(
      this.uIntensityDirectional.value - delta * this.DECAY_RATE,
      0,
      this.MAX_INTENSITY,
    );
    if (this.uIntensityDirectional.value === 0) this.phase = "idle";
  };

  private startPhase = () => {
    this.eventBus.emit("game-wind-start");
    this.phase = "ramp";
  };

  private endPhase = () => {
    this.eventBus.emit("game-wind-end");
    this.phase = "decay";
  };

  private clearTargetIfReached = () => {
    if (!this.target) return;
    const dx = this.target.position.x - this.playerPositionXZ.x;
    const dz = this.target.position.z - this.playerPositionXZ.y;
    const distanceSq = dx * dx + dz * dz;

    if (distanceSq > this.targetArrivalRadiusSquared) return;

    this.target = undefined;
    this.eventBus.emit("wind-target-change", null);
    if (this.phase === "direction") this.phase = "idle";
  };

  private handleWindBlowing = ({ player, delta }: State) => {
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

  activateLandmark = (landmarkId: string) => {
    const landmark = this.landmarks.getById(landmarkId);
    if (!landmark) return false;

    const { position, arrivalRadius } = landmark;
    const arrivalRadiusSquared = arrivalRadius * arrivalRadius;
    if (this.hasPlayerPosition) {
      const dx = position.x - this.playerPositionXZ.x;
      const dz = position.z - this.playerPositionXZ.y;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq <= arrivalRadiusSquared) return false;
    }

    this.target = landmark;
    this.targetArrivalRadiusSquared = arrivalRadiusSquared;
    this.targetPositionXZ.set(position.x, position.z);
    this.eventBus.emit("wind-target-change", landmarkId);
    return true;
  };

  get activeLandmarkId() {
    return this.target?.id ?? null;
  }
}
