import { Collider, EventQueue, World } from "@dimforge/rapier3d";
import { RevoColliderType } from "../types";
import { audioManager } from "./AudioManager";
import { MathUtils, Vector3 } from "three";
import { LineSegments2 } from "three/examples/jsm/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/Addons.js";
import { Line2NodeMaterial } from "three/webgpu";
import { sceneManager } from "./SceneManager";

const getConfig = () => {
  return {
    minImpactSq: 5,
    maxImpactSq: 400,
    minImpactVolume: 0.01,
    maxImpactVolume: 0.25,
  };
};

const config = getConfig();

class Physics {
  world!: World;
  private eventQueue!: EventQueue;
  private readonly IS_DEBUGGING_ENABLED = false;

  private dummyVectorLinVel = new Vector3();
  private debugMesh?: LineSegments2;

  constructor() {
    if (!this.IS_DEBUGGING_ENABLED) return;
    this.debugMesh = this.createDebugMesh();
    sceneManager.scene.add(this.debugMesh);
  }

  async initAsync() {
    return import("@dimforge/rapier3d").then(() => {
      this.world = new World({ x: 0, y: -9.81, z: 0 });
      this.eventQueue = new EventQueue(true);
    });
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

  update() {
    this.updateDebugMesh();
    this.world.step(this.eventQueue);
    if (audioManager.isReady) this.handleCollisionSounds();
  }
}

export const physicsManager = new Physics();
