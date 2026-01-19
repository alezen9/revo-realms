import { Collider, EventQueue, World } from "@dimforge/rapier3d";
import { RevoColliderType } from "../types";
import { audioManager } from ".";
import { MathUtils, Vector3 } from "three";
import { LineSegments2 } from "three/examples/jsm/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/Addons.js";
import { Line2NodeMaterial } from "three/webgpu";
import type { EventsManager } from "./EventsManager";
import type { SceneManager } from "./SceneManager";

const config = {
  minImpactSq: 5,
  maxImpactSq: 400,
  minImpactVolume: 0.01,
  maxImpactVolume: 0.25,
};

export class PhysicsManager {
  world!: World;
  private eventQueue!: EventQueue;
  private readonly IS_DEBUGGING_ENABLED = false;
  private baseTimestep = 1 / 60; // 60Hz fixed timestep (standard for games)
  private timeScale = 1;
  private accumulator = 0;
  private maxStepsPerFrame = 8; // prevent spiral of death
  private _didStep = false;

  private dummyVectorLinVel = new Vector3();
  private debugMesh?: LineSegments2;

  constructor(eventsManager: EventsManager, sceneManager: SceneManager) {
    if (this.IS_DEBUGGING_ENABLED) {
      this.debugMesh = this.createDebugMesh();
      sceneManager.scene.add(this.debugMesh);
    }
    eventsManager.on("engine-time-scale", (scale) => {
      this.setTimeScale(scale);
    });
  }

  async initAsync() {
    return import("@dimforge/rapier3d").then(() => {
      this.world = new World({ x: 0, y: -9.81, z: 0 });
      this.eventQueue = new EventQueue(true);
      this.world.timestep = this.baseTimestep;
      this.applyTimeScale();
    });
  }

  setTimeScale(scale: number) {
    this.timeScale = Math.max(0, scale);
    this.applyTimeScale();
  }

  private applyTimeScale() {
    if (!this.world) return;
    if (this.timeScale === 0) return;
    const timestep = this.baseTimestep * this.timeScale;
    if (this.world.timestep !== timestep) this.world.timestep = timestep;
  }

  private getColliderName(collider: Collider) {
    return (collider?.parent?.()?.userData as any)?.type as RevoColliderType;
  }

  private impactToVolume(intensity: number): number {
    const raw = MathUtils.mapLinear(
      intensity,
      config.minImpactSq,
      config.maxImpactSq,
      config.minImpactVolume,
      config.maxImpactVolume,
    );
    return MathUtils.clamp(raw, config.minImpactVolume, config.maxImpactVolume);
  }

  private onCollisionWithWood(playerCollider: Collider) {
    const linvel = playerCollider.parent()?.linvel();
    if (!linvel) return;
    this.dummyVectorLinVel.copy(linvel);
    const intensity = this.dummyVectorLinVel.lengthSq();
    if (intensity < config.minImpactSq) return;
    const volume = this.impactToVolume(intensity);
    audioManager.hitWood.setVolume(volume);
    audioManager.hitWood.play();
  }

  private onCollisionWithStone(playerCollider: Collider) {
    const linvel = playerCollider.parent()?.linvel();
    if (!linvel) return;
    this.dummyVectorLinVel.copy(linvel);
    const intensity = this.dummyVectorLinVel.lengthSq();
    if (intensity < config.minImpactSq) return;
    const volume = this.impactToVolume(intensity);
    audioManager.hitStone.setVolume(volume);
    audioManager.hitStone.play();
  }

  private handleCollisionSounds() {
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (audioManager.isMute) return;
      const collider1 = this.world.getCollider(handle1);
      const collider2 = this.world.getCollider(handle2);

      const isPlayer =
        this.getColliderName(collider1) === RevoColliderType.Player;
      if (!isPlayer || !started) return;

      const collidedWith = this.getColliderName(collider2);

      switch (collidedWith) {
        case RevoColliderType.Wood:
          this.onCollisionWithWood(collider1);
          break;
        case RevoColliderType.Stone:
          this.onCollisionWithStone(collider1);
          break;
        default:
          break;
      }
    });
  }

  private createDebugMesh() {
    const debugMesh = new LineSegments2(
      new LineSegmentsGeometry(),
      new Line2NodeMaterial(),
    );
    return debugMesh;
  }

  private updateDebugMesh() {
    if (!this.debugMesh) return;
    const debugBuffer = this.world.debugRender();

    this.debugMesh.geometry.dispose();
    this.debugMesh.geometry = new LineSegmentsGeometry();
    this.debugMesh.geometry.setPositions(debugBuffer.vertices);
    this.debugMesh.computeLineDistances();
  }

  /** interpolation factor (0-1) for smooth rendering between physics steps */
  get alpha() {
    if (!this.world) return 1;
    return this.accumulator / this.world.timestep;
  }

  /** use to update prev state */
  get didStep() {
    return this._didStep;
  }

  update(delta: number) {
    if (!this.world) return;
    this.updateDebugMesh();

    // fixed timestep with accumulator
    this.accumulator += delta;
    const timestep = this.world.timestep;
    let steps = 0;

    while (this.accumulator >= timestep && steps < this.maxStepsPerFrame) {
      this.world.step(this.eventQueue);
      this.accumulator -= timestep;
      steps++;
    }

    this._didStep = steps > 0;

    // clamp accumulator to prevent buildup during long frames
    if (this.accumulator > timestep) this.accumulator = timestep;

    if (audioManager.isReady) this.handleCollisionSounds();
  }
}
