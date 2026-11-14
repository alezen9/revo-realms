import { MathUtils, Mesh, Object3D, Quaternion, Vector3 } from "three";
import type { Collider, RigidBody } from "@dimforge/rapier3d";
import { type State } from "../../Game";
import {
  assets,
  eventBus,
  graphics,
  lighting,
  physicsScheduler,
  stage,
} from "../../systems";
import { PlayerBuoyancy } from "./PlayerBuoyancy";
import { PlayerCamera } from "./PlayerCamera";
import { createPlayerCollider } from "./playerCollider";
import { playerConfig as config, playerUniforms } from "./playerConfig";
import { debugPlayer } from "./playerDebug";
import { PlayerDeformation } from "./PlayerDeformation";
import { PlayerMaterial } from "./PlayerMaterial";
import { PlayerMovement } from "./PlayerMovement";

const ZERO_VELOCITY = { x: 0, y: 0, z: 0 };

export class Player {
  private mesh: Mesh;
  private visualRoot: Object3D;
  private rigidBody: RigidBody;
  private collider: Collider;

  private camera = new PlayerCamera(stage.playerCamera);
  private buoyancy: PlayerBuoyancy;
  private movement: PlayerMovement;
  private deformation: PlayerDeformation;

  private bodyPosition = new Vector3();
  private angularVelocity = new Vector3();
  private previousPhysicsPosition = new Vector3();
  private physicsPosition = new Vector3();
  private previousPhysicsRotation = new Quaternion();
  private physicsRotation = new Quaternion();
  private bodyRotation = new Quaternion();

  constructor() {
    this.mesh = this.createCharacterMesh();
    this.visualRoot = this.createVisualRoot(this.mesh);
    stage.mainScene.add(this.visualRoot);
    graphics.vsmPass.registerCaster(this.mesh, { type: "dynamic" });

    const { rigidBody, collider } = createPlayerCollider();
    this.rigidBody = rigidBody;
    this.collider = collider;

    rigidBody.translation(this.previousPhysicsPosition);
    rigidBody.rotation(this.previousPhysicsRotation);
    this.physicsPosition.copy(this.previousPhysicsPosition);
    this.physicsRotation.copy(this.previousPhysicsRotation);

    this.deformation = new PlayerDeformation(
      this.visualRoot,
      this.mesh,
      rigidBody,
    );
    this.buoyancy = new PlayerBuoyancy(rigidBody);
    this.movement = new PlayerMovement(rigidBody, this.buoyancy);

    eventBus.on("engine-before-physics", this.onBeforePhysics);
    eventBus.on("engine-after-physics", this.onAfterPhysics);
    eventBus.on("engine-render-update", this.onEngineUpdate);
    eventBus.on("engine-render-update-throttle-64x", this.onFallCheck);
    lighting.setTarget(this.visualRoot);
    debugPlayer(this.collider);
  }

  private createCharacterMesh() {
    const mesh = assets.getMesh("football", assets.resources.footballModel);
    mesh.material = new PlayerMaterial();
    mesh.position.set(0, 0, 0);
    return mesh;
  }

  private createVisualRoot(mesh: Mesh) {
    const visualRoot = new Object3D();
    visualRoot.position.copy(config.PLAYER_INITIAL_POSITION);
    visualRoot.add(mesh);
    return visualRoot;
  }

  private onBeforePhysics = (state: State) => {
    const { delta } = state;

    this.rigidBody.translation(this.bodyPosition);
    this.buoyancy.update(delta, this.bodyPosition);
    const hasJumped = this.movement.update(delta);
    if (hasJumped) this.deformation.noteJump();
  };

  private onAfterPhysics = (state: State) => {
    const { delta } = state;
    const { movement } = this;

    movement.updateGrounding();
    this.deformation.update(
      delta,
      movement.isGrounded,
      this.buoyancy.isInWater,
      movement.forward,
    );

    this.previousPhysicsPosition.copy(this.physicsPosition);
    this.previousPhysicsRotation.copy(this.physicsRotation);
    this.rigidBody.translation(this.physicsPosition);
    this.rigidBody.rotation(this.physicsRotation);
  };

  private onEngineUpdate = (state: State) => {
    const { delta } = state;
    const { alpha } = physicsScheduler;
    const { yaw, previousYaw } = this.movement;
    const {
      SPIN_BLUR_START_IN_RADIANS_PER_SECOND: blurStart,
      SPIN_BLUR_FULL_IN_RADIANS_PER_SECOND: blurFull,
    } = config;

    this.visualRoot.position.lerpVectors(
      this.previousPhysicsPosition,
      this.physicsPosition,
      alpha,
    );
    this.bodyRotation.slerpQuaternions(
      this.previousPhysicsRotation,
      this.physicsRotation,
      alpha,
    );
    this.deformation.apply(delta, this.bodyRotation);

    const yawOffset = yaw - previousYaw;
    const shortestYawOffset = Math.atan2(
      Math.sin(yawOffset),
      Math.cos(yawOffset),
    );
    const interpolatedYaw = previousYaw + shortestYawOffset * alpha;
    this.camera.update(delta, this.visualRoot.position, interpolatedYaw);
    stage.syncPlayerCameraUniforms();

    this.rigidBody.angvel(this.angularVelocity);
    const spinRate = this.angularVelocity.length();
    playerUniforms.uSpinFactor.value = MathUtils.smoothstep(
      spinRate,
      blurStart,
      blurFull,
    );
  };

  private onFallCheck = () => {
    const { PLAYER_INITIAL_POSITION } = config;
    if (this.visualRoot.position.y > config.RESET_Y_IN_METERS) return;

    this.rigidBody.setLinvel(ZERO_VELOCITY, false);
    this.rigidBody.setAngvel(ZERO_VELOCITY, false);
    this.rigidBody.setTranslation(PLAYER_INITIAL_POSITION, true);

    this.previousPhysicsPosition.copy(PLAYER_INITIAL_POSITION);
    this.physicsPosition.copy(PLAYER_INITIAL_POSITION);
    this.previousPhysicsRotation.identity();
    this.physicsRotation.identity();
    this.bodyRotation.identity();
    this.visualRoot.position.copy(PLAYER_INITIAL_POSITION);
    this.deformation.reset();

    this.camera.snapYaw(this.movement.yaw);
    this.movement.resetJumps();
  };

  get position() {
    return this.visualRoot.position;
  }

  get yaw() {
    return this.movement.yaw;
  }

  get radius() {
    return config.RADIUS_IN_METERS;
  }
}
