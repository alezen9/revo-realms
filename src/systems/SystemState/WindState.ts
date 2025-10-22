import { MathUtils, Vector2, Vector3 } from "three";
import { eventsManager } from "../EventsManager";
import { uniform } from "three/tsl";
import { FolderApi } from "tweakpane";

type WindTarget = {
  id: string;
  label: string;
  position: Vector3;
  resumeSq: number;
  minSq: number;
  maxSq: number;
};

export class WindState {
  // uniforms
  private _uDirection = uniform(new Vector2(1, 0).normalize()); // XZ
  private _uIntensity = uniform(0); // 0..1

  // targets
  private idCounter = 0;
  private targets = new Map<string, WindTarget>();
  private target?: WindTarget;
  private targetPositionXZ = new Vector2(0, 0);
  private isTargetReached = true;
  private isRetargeting = false;

  // debug
  private folder: FolderApi;

  private playerPositionXZ = new Vector2(0, 0);
  private toTarget = new Vector2(0, 0);

  private readonly TURN_RATE = 0.35; // direction smoothing
  private readonly INTENSITY_RATE = 0.35; // follow smoothing
  private readonly DECAY_RATE = 0.35; // fade during retarget + settle
  private readonly REACHED_HYSTERESIS = 1.1; // avoids boundary flicker

  constructor(folder: FolderApi) {
    this.folder = folder.addFolder({ title: "Wind" });

    eventsManager.on("update-throttle-4x", ({ player, delta }) => {
      this.update(player.position, delta);
      this.settleIntensity(delta);
    });
  }

  get uDirection() {
    return this._uDirection;
  }
  get uIntensity() {
    return this._uIntensity;
  }

  addTarget(
    label: string,
    position: Vector3,
    minIntensityRadius: number,
    maxIntensityRadius: number,
  ): string {
    const targetId = `windTarget-${++this.idCounter}`;
    this.targets.set(targetId, {
      id: targetId,
      label,
      position,
      resumeSq: (minIntensityRadius * this.REACHED_HYSTERESIS) ** 2,
      minSq: minIntensityRadius * minIntensityRadius,
      maxSq: maxIntensityRadius * maxIntensityRadius,
    });

    this.folder
      .addButton({ label: "Sway towards", title: label })
      .on("click", () => this.setActiveTargetById(targetId));

    return targetId;
  }

  setActiveTargetById(id: string) {
    const target = this.targets.get(id);
    if (!target) return;
    this.target = target;
    this.targetPositionXZ.set(target.position.x, target.position.z);
    this.isTargetReached = false;
    this.isRetargeting = true;
  }

  private settleIntensity(delta: number) {
    if (!this.isTargetReached) return;
    if (this._uIntensity.value === 0) return;
    const t = 1 - Math.exp(-this.DECAY_RATE * delta);
    this._uIntensity.value = Math.max(0, this._uIntensity.value - t);
  }

  private update(playerPosition: Vector3, delta: number) {
    if (this.isTargetReached || !this.target) return;

    // retargeting = fade intensity first, hold direction
    if (this.isRetargeting) {
      const decayT = 1 - Math.exp(-this.DECAY_RATE * delta);
      this._uIntensity.value = Math.max(0, this._uIntensity.value - decayT);
      if (this._uIntensity.value <= 0) this.isRetargeting = false;
      return;
    }

    const turnT = 1 - Math.exp(-this.TURN_RATE * delta);
    const intenT = 1 - Math.exp(-this.INTENSITY_RATE * delta);

    // positions & raw delta
    this.playerPositionXZ.set(playerPosition.x, playerPosition.z);
    this.toTarget.subVectors(this.playerPositionXZ, this.targetPositionXZ);

    // normalize using lenSq (slightly cheaper than normalize())
    const lenSq = this.toTarget.lengthSq();
    const invLen = 1 / Math.sqrt(lenSq);
    this.toTarget.multiplyScalar(invLen);

    // smooth direction
    this._uDirection.value.lerp(this.toTarget, turnT).normalize();

    // intensity: stronger when farther
    const targetIntensity = MathUtils.smoothstep(
      lenSq,
      this.target.minSq,
      this.target.maxSq,
    );

    // smooth intensity toward target
    this._uIntensity.value +=
      (targetIntensity - this._uIntensity.value) * intenT;

    // reached check with hysteresis
    if (!this.isTargetReached && lenSq <= this.target.minSq)
      this.isTargetReached = true;
    else if (this.isTargetReached && lenSq > this.target.resumeSq)
      this.isTargetReached = false;

    // final guard
    this._uIntensity.value = MathUtils.clamp(this._uIntensity.value, 0, 1);
  }
}
