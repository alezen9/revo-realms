import { ConeGeometry, Mesh, Vector2, Vector3 } from "three";
import { atan, positionLocal, rotate, uniform, vec3 } from "three/tsl";
import { FolderApi } from "tweakpane";
import { MeshLambertNodeMaterial } from "three/webgpu";
import { eventsManager, sceneManager } from ".";
import { type State } from "../Game";
import type { EventsManager } from "./EventsManager";

type WindTarget = {
  id: string;
  label: string;
  position: Vector3;
  radiusSq: number;
};

type Phase = "idle" | "direction" | "start" | "ramp" | "hold" | "end" | "decay";

const ENABLE_DEBUGGING = false;

export class WindManager {
  private readonly IS_DEBUGGING_ENABLED =
    import.meta.env.DEV && ENABLE_DEBUGGING;

  // uniforms
  private _uDirection = uniform(new Vector2(0, -1));
  private _uIntensity = uniform(0.1);

  private phase: Phase = "idle";
  private readonly AMBIENT_INTENSITY = 0.1;
  private readonly MAX_INTENSITY = 1;
  private readonly RAMP_RATE = 1.5;
  private readonly DECAY_RATE = 0.85;

  // targets
  private idCounter = 0;
  private targets = new Map<string, WindTarget>();
  private target?: WindTarget;
  private targetPositionXZ = new Vector2(0, 0);

  private playerPositionXZ = new Vector2(0, 0);
  private toTargetDir = new Vector2(0, 0);

  private HOLD_INTENSITY_TIME_S = 3;
  private accTimer = 0;

  constructor(eventsManager: EventsManager) {
    this.IS_DEBUGGING_ENABLED && this.debug(eventsManager);

    eventsManager.on("swipe-up", this.handleSwipeUp.bind(this));
    eventsManager.on(
      "engine-update-throttle-4x",
      this.handleWindBlowing.bind(this),
    );
  }

  private handleSwipeUp() {
    if (!this.target || this.phase !== "idle") return;
    this.phase = "direction";
  }

  private directionPhase(player: State["player"]) {
    this.playerPositionXZ.set(player.position.x, player.position.z);
    this.toTargetDir.subVectors(this.targetPositionXZ, this.playerPositionXZ);
    const lenSq = this.toTargetDir.lengthSq();

    if (lenSq <= (this.target?.radiusSq ?? 0)) {
      this.target = undefined;
      this.phase = "idle";
      eventsManager.emit("wind-target-change", null);
      return;
    }

    const invLen = 1 / Math.sqrt(lenSq);
    this.toTargetDir.multiplyScalar(invLen);
    this.uDirection.value.copy(this.toTargetDir);
    this.phase = "start";
  }

  private rampPhase(delta: number) {
    this._uIntensity.value += delta * this.RAMP_RATE;
    this._uIntensity.value = Math.min(
      this._uIntensity.value,
      this.MAX_INTENSITY,
    );
    if (this._uIntensity.value === this.MAX_INTENSITY) this.phase = "hold";
  }

  private holdPhase(delta: number) {
    this.accTimer += delta;
    if (this.accTimer < this.HOLD_INTENSITY_TIME_S) return;
    this.phase = "end";
    this.accTimer = 0;
  }

  private decayPhase(delta: number) {
    this._uIntensity.value -= delta * this.DECAY_RATE;
    this._uIntensity.value = Math.max(
      this._uIntensity.value,
      this.AMBIENT_INTENSITY,
    );
    if (this._uIntensity.value === this.AMBIENT_INTENSITY) this.phase = "idle";
  }

  private startPhase() {
    eventsManager.emit("game-wind-start");
    this.phase = "ramp";
  }

  private endPhase() {
    eventsManager.emit("game-wind-end");
    this.phase = "decay";
  }

  private handleWindBlowing({ player, delta }: State) {
    if (!this.target) return;
    if (this.phase === "direction") return this.directionPhase(player);
    if (this.phase === "start") return this.startPhase();
    if (this.phase === "ramp") return this.rampPhase(delta);
    if (this.phase === "hold") return this.holdPhase(delta);
    if (this.phase === "end") return this.endPhase();
    if (this.phase === "decay") return this.decayPhase(delta);
  }

  private debug(eventsManager: EventsManager) {
    const material = new MeshLambertNodeMaterial();
    material.colorNode = vec3(this._uIntensity);
    const angle = atan(this._uDirection.x, this._uDirection.y.negate());
    material.positionNode = rotate(positionLocal, vec3(0, angle, 0));
    const geom = new ConeGeometry(1, 3);
    geom.rotateX(-Math.PI / 2);
    const mesh = new Mesh(geom, material);

    sceneManager.scene.add(mesh);

    eventsManager.on("engine-update", ({ player }) => {
      mesh.position.copy(player.position).setY(5);
    });
  }

  get uDirection() {
    return this._uDirection;
  }
  get uIntensity() {
    return this._uIntensity;
  }

  registerTarget(label: string, position: Vector3, radius: number): string {
    const targetId = `windTarget-${++this.idCounter}`;
    this.targets.set(targetId, {
      id: targetId,
      label,
      position,
      radiusSq: radius * radius,
    });

    // Debug buttons removed - wind targets are now selected via RadialMenu
    return targetId;
  }

  activateTargetById(id: string) {
    const target = this.targets.get(id);
    if (!target) return;
    this.target = target;
    this.targetPositionXZ.set(target.position.x, target.position.z);
    eventsManager.emit("wind-target-change", id);
  }

  get activeTargetId() {
    return this.target?.id ?? null;
  }
}
