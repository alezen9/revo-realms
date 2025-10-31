import { Vector2, Vector3 } from "three";
import { uniform } from "three/tsl";
import { FolderApi } from "tweakpane";
import { eventsManager } from "../EventsManager";

/** Bind these in your materials. */
const windUniforms = {
  uDirection: uniform(new Vector2(0, -1)), // world XZ, unit
  uIntensity: uniform(0), // 0..1
};

/** Target shape */
export type WindTarget = {
  id: string;
  label: string;
  position: Vector3; // externally owned; read x/z only
  greenZoneSq: number; // arrival radius^2
};

/** Config factory — change numbers here only. */
export const getConfig = () => ({
  ambientIntensity: 0.16,
  maxGuidingExtraIntensity: 0.9,
  turnSpeedRadiansPerSecond: 1.0,
  intensityRiseRatePerSecond: 1.0,
  intensityDecayRatePerSecond: 0.7,
  primaryOscillationFrequencyHz: 0.12,
  secondaryOscillationFrequencyHz: 0.07,
  secondaryOscillationPhaseRadians: Math.PI * 0.4,
  secondaryOscillationBlend: 0.45,
});
const config = getConfig();

/** Small helpers */
export const clamp = (value: number, min = 0, max = 1) =>
  value < min ? min : value > max ? max : value;

export class WindController {
  readonly targets = new Map<string, WindTarget>();

  private activeTargetId: string | null = null;
  private elapsedSeconds = 0;
  private idCounter = 0;

  // Scratch (no allocations per frame)
  private playerXZ = new Vector2();
  private targetXZ = new Vector2();
  private desiredDirectionXZ = new Vector2();

  private folder: FolderApi;

  constructor(folder: FolderApi) {
    windUniforms.uIntensity.value = clamp(config.ambientIntensity);

    eventsManager.on("update-throttle-4x", ({ delta, player }) => {
      this.update(delta, player.position);
    });

    // Always create a folder and bind controls
    const f = folder.addFolder({ title: "Wind" });
    f.addBinding(config, "ambientIntensity", {
      min: 0,
      max: 0.5,
      step: 0.01,
      label: "Ambient",
    });
    f.addBinding(config, "maxGuidingExtraIntensity", {
      min: 0,
      max: 1,
      step: 0.01,
      label: "Max Extra",
    });
    f.addBinding(config, "turnSpeedRadiansPerSecond", {
      min: 0.1,
      max: 4,
      step: 0.05,
      label: "TurnSpeed",
    });
    f.addBinding(config, "intensityRiseRatePerSecond", {
      min: 0.1,
      max: 5,
      step: 0.1,
      label: "Rise",
    });
    f.addBinding(config, "intensityDecayRatePerSecond", {
      min: 0.1,
      max: 5,
      step: 0.1,
      label: "Decay",
    });
    f.addBinding(config, "primaryOscillationFrequencyHz", {
      min: 0.01,
      max: 0.5,
      step: 0.01,
      label: "Osc1 Hz",
    });
    f.addBinding(config, "secondaryOscillationFrequencyHz", {
      min: 0.01,
      max: 0.5,
      step: 0.01,
      label: "Osc2 Hz",
    });
    f.addBinding(config, "secondaryOscillationBlend", {
      min: 0,
      max: 1,
      step: 0.01,
      label: "Osc2 Mix",
    });
    this.folder = f;
  }

  get uDirection() {
    return windUniforms.uDirection;
  }

  get uIntensity() {
    return windUniforms.uIntensity;
  }

  // --- Targets management ---
  registerTarget(
    label: string,
    position: Vector3,
    minRadiusMeters: number,
  ): string {
    const id = `windTarget-${++this.idCounter}`;
    const target: WindTarget = {
      id,
      label,
      position,
      greenZoneSq: minRadiusMeters * minRadiusMeters,
    };
    this.targets.set(id, target);

    this.folder
      .addButton({ label: "Sway towards", title: label })
      .on("click", () => this.activateTarget(id));

    return id;
  }

  removeTarget(id: string): void {
    if (this.activeTargetId === id) this.clearActiveTarget();
    this.targets.delete(id);
  }

  activateTarget(id: string): void {
    if (!this.targets.has(id)) return;
    this.activeTargetId = id;
  }

  clearActiveTarget(): void {
    this.activeTargetId = null; // keep direction; intensity will decay to ambient
  }

  // --- Update loop ---
  update(deltaSeconds: number, playerWorldPosition: Vector3): void {
    this.elapsedSeconds += deltaSeconds;

    const hasDesiredDirection =
      this.hasDesiredDirectionToTarget(playerWorldPosition);
    if (hasDesiredDirection) this.rotateDirectionTowardDesired(deltaSeconds);

    const targetIntensity = this.computeTargetIntensity();
    this.smoothIntensity(deltaSeconds, targetIntensity);

    if (
      this.activeTargetId &&
      this.isPlayerInsideActiveTarget(playerWorldPosition)
    ) {
      this.clearActiveTarget();
    }
  }

  // --- Internals ---
  private hasDesiredDirectionToTarget(playerWorldPosition: Vector3): boolean {
    if (!this.activeTargetId) return false;
    const target = this.targets.get(this.activeTargetId);
    if (!target) {
      this.activeTargetId = null;
      return false;
    }

    this.playerXZ.set(playerWorldPosition.x, playerWorldPosition.z);
    this.targetXZ.set(target.position.x, target.position.z);

    this.desiredDirectionXZ.copy(this.targetXZ).sub(this.playerXZ);
    const lengthSq = this.desiredDirectionXZ.lengthSq();
    if (lengthSq === 0) return false;

    this.desiredDirectionXZ.multiplyScalar(1 / Math.sqrt(lengthSq));
    return true;
  }

  private rotateDirectionTowardDesired(deltaSeconds: number): void {
    const current = windUniforms.uDirection.value;
    const desired = this.desiredDirectionXZ;

    const currentAngle = Math.atan2(current.y, current.x);
    const desiredAngle = Math.atan2(desired.y, desired.x);

    let deltaAngle = desiredAngle - currentAngle;
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    else if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    const maxStep = config.turnSpeedRadiansPerSecond * deltaSeconds;
    const step =
      Math.abs(deltaAngle) <= maxStep
        ? deltaAngle
        : Math.sign(deltaAngle) * maxStep;
    if (step === 0) return;

    const cosStep = Math.cos(step);
    const sinStep = Math.sin(step);
    const newX = cosStep * current.x - sinStep * current.y;
    const newY = sinStep * current.x + cosStep * current.y;
    current.set(newX, newY); // stays normalized
  }

  private computeTargetIntensity(): number {
    let target = config.ambientIntensity;
    if (!this.activeTargetId) return clamp(target);

    // gentle dual-sine breathing while guiding
    const primarySine = Math.sin(
      2 * Math.PI * config.primaryOscillationFrequencyHz * this.elapsedSeconds,
    );
    const secondarySine = Math.sin(
      2 *
        Math.PI *
        config.secondaryOscillationFrequencyHz *
        this.elapsedSeconds +
        config.secondaryOscillationPhaseRadians,
    );

    const blended =
      (1 - config.secondaryOscillationBlend) * primarySine +
      config.secondaryOscillationBlend * secondarySine;

    const normalized01 = 0.5 + 0.5 * blended;
    const eased01 = normalized01 * normalized01 * (3 - 2 * normalized01); // smoothstep-like
    target =
      config.ambientIntensity + eased01 * config.maxGuidingExtraIntensity;

    return clamp(target);
  }

  private smoothIntensity(deltaSeconds: number, targetIntensity: number): void {
    const current = windUniforms.uIntensity.value;
    if (current === targetIntensity) return;

    const rising = targetIntensity > current;
    const rate = rising
      ? config.intensityRiseRatePerSecond
      : config.intensityDecayRatePerSecond;
    const step = Math.min(1, rate * deltaSeconds);
    windUniforms.uIntensity.value =
      current + (targetIntensity - current) * step;
  }

  private isPlayerInsideActiveTarget(playerWorldPosition: Vector3): boolean {
    const target = this.activeTargetId
      ? this.targets.get(this.activeTargetId)
      : null;
    if (!target) return false;

    const dx = target.position.x - playerWorldPosition.x;
    const dz = target.position.z - playerWorldPosition.z;
    return dx * dx + dz * dz <= target.greenZoneSq;
  }
}
