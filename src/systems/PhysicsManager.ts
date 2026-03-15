import { Collider, EventQueue, World } from "@dimforge/rapier3d";
import { RevoColliderType } from "../types";
import { MathUtils, Vector3 } from "three";
import { LineSegments2 } from "three/examples/jsm/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/Addons.js";
import { Line2NodeMaterial } from "three/webgpu";
import type { EventsManager } from "./EventsManager";
import type { SceneManager } from "./SceneManager";
import type { AudioManager } from "./AudioManager";

const config = {
  minImpactSq: 5,
  maxImpactSq: 400,
  minImpactVolume: 0.01,
  maxImpactVolume: 0.25,
  debugRefreshInterval: 1 / 240,
};

export class PhysicsManager {
  world!: World;
  private eventQueue!: EventQueue;
  private readonly IS_DEBUGGING_ENABLED = true;
  private baseTimestep = 1 / 60; // 60Hz fixed timestep (standard for games)
  private timeScale = 1;
  private accumulator = 0;
  private maxStepsPerFrame = 8; // prevent spiral of death
  private _didStep = false;
  private audioManager: AudioManager;
  private sceneManager: SceneManager;
  private debugRefreshAccumulator = 0;

  private dummyVectorLinVel = new Vector3();
  private debugMesh?: LineSegments2;
  private debugGeometry?: LineSegmentsGeometry;

  constructor(
    eventsManager: EventsManager,
    sceneManager: SceneManager,
    audioManager: AudioManager,
  ) {
    this.audioManager = audioManager;
    this.sceneManager = sceneManager;
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
    return collider.userData?.type;
  }

  private getDebugAttributes() {
    if (!this.debugGeometry) return null;
    const instanceStart = this.debugGeometry.attributes.instanceStart;
    const instanceEnd = this.debugGeometry.attributes.instanceEnd;
    const positions = instanceStart.array;
    return { instanceStart, instanceEnd, positions };
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
    this.audioManager.hitWood.setVolume(volume);
    this.audioManager.hitWood.play();
  }

  private onCollisionWithStone(playerCollider: Collider) {
    const linvel = playerCollider.parent()?.linvel();
    if (!linvel) return;
    this.dummyVectorLinVel.copy(linvel);
    const intensity = this.dummyVectorLinVel.lengthSq();
    if (intensity < config.minImpactSq) return;
    const volume = this.impactToVolume(intensity);
    this.audioManager.hitStone.setVolume(volume);
    this.audioManager.hitStone.play();
  }

  private handleCollisionSounds() {
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (this.audioManager.isMute) return;
      if (!started) return;

      const collider1 = this.world.getCollider(handle1);
      const collider2 = this.world.getCollider(handle2);
      if (!collider1 || !collider2) return;

      const collider1Type = this.getColliderName(collider1);
      const collider2Type = this.getColliderName(collider2);

      let playerCollider: Collider | null = null;
      let collidedWith: RevoColliderType | undefined;

      if (collider1Type === RevoColliderType.Player) {
        playerCollider = collider1;
        collidedWith = collider2Type;
      } else if (collider2Type === RevoColliderType.Player) {
        playerCollider = collider2;
        collidedWith = collider1Type;
      }

      if (!playerCollider) return;

      switch (collidedWith) {
        case RevoColliderType.Wood:
          this.onCollisionWithWood(playerCollider);
          break;
        case RevoColliderType.Stone:
          this.onCollisionWithStone(playerCollider);
          break;
        default:
          break;
      }
    });
  }

  private createDebugMesh(positions: Float32Array) {
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    this.debugGeometry = geometry;

    const material = new Line2NodeMaterial();

    const debugMesh = new LineSegments2(geometry, material);
    debugMesh.frustumCulled = false;
    return debugMesh;
  }

  private updateDebugMesh() {
    const debugBuffer = this.world.debugRender();
    if (!debugBuffer.vertices.length) return;

    if (!this.debugMesh) {
      this.debugMesh = this.createDebugMesh(debugBuffer.vertices);
      this.sceneManager.scene.add(this.debugMesh);
      return;
    }

    const debugAttributes = this.getDebugAttributes();
    if (!this.debugGeometry || !debugAttributes) return;

    if (debugAttributes.positions.length !== debugBuffer.vertices.length) {
      this.debugGeometry.setPositions(debugBuffer.vertices);
      return;
    }

    debugAttributes.positions.set(debugBuffer.vertices);
    debugAttributes.instanceStart.needsUpdate = true;
    debugAttributes.instanceEnd.needsUpdate = true;
  }

  // interpolation factor (0-1) for smooth rendering between physics steps
  get alpha() {
    if (!this.world) return 1;
    return this.accumulator / this.world.timestep;
  }

  // use to update prev state
  get didStep() {
    return this._didStep;
  }

  update(delta: number) {
    if (!this.world) return;

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

    if (this.IS_DEBUGGING_ENABLED && this._didStep) {
      this.debugRefreshAccumulator += delta;
      if (
        !this.debugMesh ||
        this.debugRefreshAccumulator >= config.debugRefreshInterval
      ) {
        this.updateDebugMesh();
        this.debugRefreshAccumulator = 0;
      }
    }

    if (this.audioManager.isReady) this.handleCollisionSounds();
  }
}
