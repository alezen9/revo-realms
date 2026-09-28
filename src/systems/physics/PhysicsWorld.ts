import {
  Collider,
  EventQueue,
  QueryFilterFlags,
  World,
} from "@dimforge/rapier3d";
import { RevoColliderType } from "./colliderTypes";
import { type Audio, MathUtils, Vector3 } from "three";
import { LineSegments2 } from "three/examples/jsm/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/Addons.js";
import { Line2NodeMaterial } from "three/webgpu";
import type { DebugPanel } from "../debug/DebugPanel";
import type { Stage } from "../scene/Stage";
import type { Sound } from "../audio/Sound";

const MIN_IMPACT_SPEED_SQUARED = 5;
const MAX_IMPACT_SPEED_SQUARED = 400;
const MIN_IMPACT_VOLUME = 0.01;
const MAX_IMPACT_VOLUME = 0.25;

export class PhysicsWorld {
  world!: World;
  private eventQueue!: EventQueue;
  private sound: Sound;
  private stage: Stage;

  private playerLinearVelocity = new Vector3();
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
    await import("@dimforge/rapier3d");
    this.world = new World({ x: 0, y: -9.81, z: 0 });
    this.eventQueue = new EventQueue(true);
    this.world.timestep = 1 / 60;
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

  private getColliderType(collider: Collider) {
    if (!collider.userData) return undefined;
    return collider.userData.type;
  }

  private playImpactSound(playerCollider: Collider, impactSound: Audio) {
    const body = playerCollider.parent();
    if (!body) return;
    body.linvel(this.playerLinearVelocity);
    const impactSpeedSquared = this.playerLinearVelocity.lengthSq();
    if (impactSpeedSquared < MIN_IMPACT_SPEED_SQUARED) return;
    const volume = MathUtils.clamp(
      MathUtils.mapLinear(
        impactSpeedSquared,
        MIN_IMPACT_SPEED_SQUARED,
        MAX_IMPACT_SPEED_SQUARED,
        MIN_IMPACT_VOLUME,
        MAX_IMPACT_VOLUME,
      ),
      MIN_IMPACT_VOLUME,
      MAX_IMPACT_VOLUME,
    );
    impactSound.setVolume(volume);
    impactSound.play();
  }

  private onCollisionEvent = (
    firstHandle: number,
    secondHandle: number,
    hasStarted: boolean,
  ) => {
    if (this.sound.isMute || !hasStarted) return;

    const firstCollider = this.world.getCollider(firstHandle);
    const secondCollider = this.world.getCollider(secondHandle);
    if (!firstCollider || !secondCollider) return;

    const firstType = this.getColliderType(firstCollider);
    const secondType = this.getColliderType(secondCollider);
    const isFirstPlayer = firstType === RevoColliderType.Player;
    const isSecondPlayer = secondType === RevoColliderType.Player;
    if (!isFirstPlayer && !isSecondPlayer) return;

    let playerCollider = firstCollider;
    let otherType = secondType;
    if (!isFirstPlayer) {
      playerCollider = secondCollider;
      otherType = firstType;
    }

    if (otherType === RevoColliderType.Wood)
      this.playImpactSound(playerCollider, this.sound.hitWood);
    if (otherType === RevoColliderType.Stone)
      this.playImpactSound(playerCollider, this.sound.hitStone);
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

    if (this.sound.isReady)
      this.eventQueue.drainCollisionEvents(this.onCollisionEvent);
  }
}
