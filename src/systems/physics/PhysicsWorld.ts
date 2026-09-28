import {
  Collider,
  EventQueue,
  QueryFilterFlags,
  World,
} from "@dimforge/rapier3d";
import { RevoColliderType } from "./colliderTypes";
import { MathUtils, Vector3 } from "three";
import { LineSegments2 } from "three/examples/jsm/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/Addons.js";
import { Line2NodeMaterial } from "three/webgpu";
import type { DebugPanel } from "../debug/DebugPanel";
import type { Stage } from "../scene/Stage";
import type { Sound } from "../audio/Sound";

const config = {
  minImpactSq: 5,
  maxImpactSq: 400,
  minImpactVolume: 0.01,
  maxImpactVolume: 0.25,
};

export class PhysicsWorld {
  world!: World;
  private eventQueue!: EventQueue;
  private sound: Sound;
  private stage: Stage;

  private dummyVectorLinVel = new Vector3();
  private fixedDebugMesh?: LineSegments2;
  private dynamicDebugMesh?: LineSegments2;
  private dynamicDebugGeometry?: LineSegmentsGeometry;
  private debug = { enabled: false };

  constructor(stage: Stage, sound: Sound, debugPanel: DebugPanel) {
    this.sound = sound;
    this.stage = stage;
    this.setupDebug(debugPanel);
  }

  async initAsync() {
    return import("@dimforge/rapier3d").then(() => {
      this.world = new World({ x: 0, y: -9.81, z: 0 });
      this.eventQueue = new EventQueue(true);
      this.world.timestep = 1 / 60;
    });
  }

  private setupDebug(debugPanel: DebugPanel) {
    const folder = debugPanel.panel.addFolder({
      title: "⚙️ Physics",
      expanded: false,
    });

    folder
      .addBinding(this.debug, "enabled", { label: "Debug render" })
      .on("change", ({ value }) => this.setDebugEnabled(value));
  }

  private setDebugEnabled(enabled: boolean) {
    this.debug.enabled = enabled;
    if (this.fixedDebugMesh) this.fixedDebugMesh.visible = enabled;
    if (this.dynamicDebugMesh) this.dynamicDebugMesh.visible = enabled;
  }

  private getColliderName(collider: Collider) {
    return collider.userData?.type;
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
    const body = playerCollider.parent();
    if (!body) return;
    body.linvel(this.dummyVectorLinVel);
    const intensity = this.dummyVectorLinVel.lengthSq();
    if (intensity < config.minImpactSq) return;
    const volume = this.impactToVolume(intensity);
    this.sound.hitWood.setVolume(volume);
    this.sound.hitWood.play();
  }

  private onCollisionWithStone(playerCollider: Collider) {
    const body = playerCollider.parent();
    if (!body) return;
    body.linvel(this.dummyVectorLinVel);
    const intensity = this.dummyVectorLinVel.lengthSq();
    if (intensity < config.minImpactSq) return;
    const volume = this.impactToVolume(intensity);
    this.sound.hitStone.setVolume(volume);
    this.sound.hitStone.play();
  }

  private handleCollisionSounds() {
    this.eventQueue.drainCollisionEvents(this.onCollisionEvent);
  }

  private onCollisionEvent = (
    handle1: number,
    handle2: number,
    started: boolean,
  ) => {
    if (this.sound.isMute) return;
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
  };

  private createDebugMesh(positions: Float32Array) {
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);

    const material = new Line2NodeMaterial();

    const debugMesh = new LineSegments2(geometry, material);
    debugMesh.frustumCulled = false;
    return { debugMesh, geometry };
  }

  private createFixedDebugMesh() {
    if (this.fixedDebugMesh) return;

    const debugBuffer = this.world.debugRender(QueryFilterFlags.ONLY_FIXED);
    if (!debugBuffer.vertices.length) return;

    const { debugMesh } = this.createDebugMesh(debugBuffer.vertices);
    this.fixedDebugMesh = debugMesh;
    debugMesh.visible = this.debug.enabled;
    this.stage.mainScene.add(debugMesh);
  }

  private updateDynamicDebugMesh() {
    const debugBuffer = this.world.debugRender(QueryFilterFlags.EXCLUDE_FIXED);
    if (!debugBuffer.vertices.length) return;

    if (!this.dynamicDebugMesh) {
      const { debugMesh, geometry } = this.createDebugMesh(
        debugBuffer.vertices,
      );
      this.dynamicDebugMesh = debugMesh;
      this.dynamicDebugGeometry = geometry;
      debugMesh.visible = this.debug.enabled;
      this.stage.mainScene.add(debugMesh);
      return;
    }

    if (!this.dynamicDebugGeometry) return;
    const instanceStart = this.dynamicDebugGeometry.attributes.instanceStart;
    const instanceEnd = this.dynamicDebugGeometry.attributes.instanceEnd;
    const positions = instanceStart.array;

    if (positions.length !== debugBuffer.vertices.length) {
      this.dynamicDebugGeometry.setPositions(debugBuffer.vertices);
      return;
    }

    positions.set(debugBuffer.vertices);
    instanceStart.needsUpdate = true;
    instanceEnd.needsUpdate = true;
  }

  private updateDebug() {
    if (!this.debug.enabled) return;

    this.createFixedDebugMesh();
    this.updateDynamicDebugMesh();
  }

  step() {
    this.world.step(this.eventQueue);
  }

  flush() {
    this.updateDebug();

    if (this.sound.isReady) this.handleCollisionSounds();
  }
}
