import { Mesh, IcosahedronGeometry, Vector3, Quaternion } from "three";
import {
  ColliderDesc,
  RigidBody,
  RigidBodyDesc,
  Ray,
  Vector,
  ActiveEvents,
} from "@dimforge/rapier3d";
import { inputManager } from "../systems/InputManager";
import { type State } from "../Game";
import {
  float,
  fract,
  mix,
  positionWorld,
  sin,
  smoothstep,
  step,
  texture,
  uniform,
  varying,
  vec3,
} from "three/tsl";
import { MeshLambertNodeMaterial } from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import { RevoColliderType, UniformType } from "../types";
import { physics } from "../systems/Physics";
import { sceneManager } from "../systems/SceneManager";
import { lighting } from "../systems/LightingSystem";
import { eventsManager } from "../systems/EventsManager";
import { tslUtils } from "../systems/TSLUtils";
import { debugManager } from "../systems/DebugManager";

const getConfig = () => {
  const jumpImpulse = 75;
  return {
    JUMP_BUFFER_DURATION_IN_SECONDS: 0.2,
    MAX_CONSECUTIVE_JUMPS: 2,
    JUMP_CUT_MULTIPLIER: 0.25,
    FALL_MULTIPLIER: 2.75,
    MAX_UPWARD_VELOCITY: 6,
    LINEAR_DAMPING: 0.35,
    ANGULAR_DAMPING: 0.6,
    JUMP_IMPULSE: new Vector3(0, jumpImpulse, 0),
    LIN_VEL_STRENGTH: 35,
    ANG_VEL_STRENGTH: 25,
    RADIUS: 0.5,
    PLAYER_INITIAL_POSITION: new Vector3(0, 5, 0),
    CAMERA_OFFSET: new Vector3(0, 11, 17),
    CAMERA_LERP_FACTOR: 7.5,
    UP: new Vector3(0, 1, 0),
    DOWN: new Vector3(0, -1, 0),
    FORWARD: new Vector3(0, 0, -1),
  };
};

const config = getConfig();

export default class Player {
  private mesh: Mesh;
  private rigidBody: RigidBody;

  private smoothedCameraPosition = new Vector3();
  private desiredCameraPosition = new Vector3();
  private smoothedCameraTarget = new Vector3();
  private desiredTargetPosition = new Vector3();

  private yawInRadians = 0;
  private prevYawInRadians = -1;
  private yawQuaternion = new Quaternion();

  private newLinVel = new Vector3();
  private newAngVel = new Vector3();
  private torqueAxis = new Vector3();
  private forwardVec = new Vector3();

  // Player State
  private isOnGround = false;
  private jumpCount = 0;
  private wasJumpHeld = false;
  private jumpBufferTimer = 0;

  private rayOrigin = new Vector3();
  private ray = new Ray(this.rayOrigin, config.DOWN);

  private uTime = uniform(0);
  private uOffsetShadow = uniform(0);

  constructor() {
    this.mesh = this.createCharacterMesh();
    sceneManager.scene.add(this.mesh);

    lighting.setTarget(this.mesh);

    this.rigidBody = physics.world.createRigidBody(this.createRigidBodyDesc());
    physics.world.createCollider(this.createColliderDesc(), this.rigidBody);

    eventsManager.on("update", this.update.bind(this));
    eventsManager.on(
      "update-throttle-60x",
      this.resetPlayerPosition.bind(this),
    );
    this.debugPlayer();
  }

  private resetPlayerPosition(state: State) {
    const { player } = state;
    if (player.position.y > -10) return;
    this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, false);
    this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, false);
    this.rigidBody.setTranslation(config.PLAYER_INITIAL_POSITION, true);
    this.mesh.position.copy(config.PLAYER_INITIAL_POSITION);
  }

  private debugPlayer() {
    const playerFolder = debugManager.panel.addFolder({
      title: "🪩 Player",
      expanded: false,
    });
    playerFolder.addBinding(config.CAMERA_OFFSET, "y", {
      label: "Main camera height",
    });
    playerFolder.addBinding(config.CAMERA_OFFSET, "z", {
      label: "Main camera distance",
    });
  }

  private createCharacterMesh() {
    const geometry = new IcosahedronGeometry(config.RADIUS, 2);
    const material = new PlayerMaterial({
      uTime: this.uTime,
      uOffsetShadow: this.uOffsetShadow,
    });
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.copy(config.PLAYER_INITIAL_POSITION);
    return mesh;
  }

  private createRigidBodyDesc() {
    const { x, y, z } = config.PLAYER_INITIAL_POSITION;
    return RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setLinearDamping(config.LINEAR_DAMPING)
      .setAngularDamping(config.ANGULAR_DAMPING)
      .setUserData({ type: RevoColliderType.Player });
  }

  private createColliderDesc() {
    return ColliderDesc.ball(config.RADIUS)
      .setRestitution(0.25)
      .setFriction(1)
      .setMass(3)
      .setActiveEvents(ActiveEvents.COLLISION_EVENTS);
  }

  private update(state: State) {
    const { clock } = state;

    const delta = clock.getDelta();

    this.uTime.value = clock.getElapsedTime();

    if (this.prevYawInRadians !== this.yawInRadians) {
      this.yawQuaternion.setFromAxisAngle(config.UP, this.yawInRadians);
      this.prevYawInRadians = this.yawInRadians;
    }

    this.updateVerticalMovement(delta);
    this.updateHorizontalMovement(delta);
    this.updateCameraPosition(delta);
  }

  private updateVerticalMovement(delta: number) {
    const isJumpKeyPressed = inputManager.isJumpPressed();

    // 1) Ground check
    this.isOnGround = this.checkIfGrounded();
    if (this.isOnGround) {
      this.jumpCount = 0;
    }

    // 2) Jump buffer
    const justPressedThisFrame = isJumpKeyPressed && !this.wasJumpHeld;
    if (justPressedThisFrame) {
      this.jumpBufferTimer = config.JUMP_BUFFER_DURATION_IN_SECONDS;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - delta);
    }

    // 3) Jump attempt
    if (this.jumpBufferTimer > 0 && this.canJump()) {
      this.performJump();
      this.jumpBufferTimer = 0;
    }

    // 4) Mid-air logic (jump cut, fast fall, clamp)
    const velocity = this.rigidBody.linvel();
    this.handleJumpCut(isJumpKeyPressed, velocity);
    this.handleFastFall(delta, velocity, physics.world.gravity.y);
    this.clampUpwardVelocity(velocity);
    this.rigidBody.setLinvel(velocity, true);

    // 5) Save jump key state
    this.wasJumpHeld = isJumpKeyPressed;
  }

  private checkIfGrounded(): boolean {
    // Cast a ray downward from just below the sphere’s center
    this.rayOrigin.copy(this.rigidBody.translation());
    this.rayOrigin.y -= config.RADIUS + 0.01;
    const maxDistance = 0.2;
    const hit = physics.world.castRay(this.ray, maxDistance, true);
    if (!hit) return false;
    const distanceToGround = hit.timeOfImpact * maxDistance;
    return distanceToGround < 0.01;
  }

  private canJump(): boolean {
    if (this.isOnGround) return true;
    return this.jumpCount < config.MAX_CONSECUTIVE_JUMPS;
  }

  private performJump() {
    this.rigidBody.applyImpulse(config.JUMP_IMPULSE, true);
    this.jumpCount += 1;
  }

  private handleJumpCut(isJumpKeyPressed: boolean, velocity: Vector) {
    const justReleasedJump = !isJumpKeyPressed && this.wasJumpHeld;
    if (!justReleasedJump || velocity.y <= 0) return;
    velocity.y *= config.JUMP_CUT_MULTIPLIER;
  }

  private handleFastFall(delta: number, velocity: Vector, gravityY: number) {
    if (velocity.y >= 0) return;
    const extraDown = config.FALL_MULTIPLIER * Math.abs(gravityY) * delta;
    velocity.y -= extraDown;
  }

  private clampUpwardVelocity(velocity: Vector) {
    if (velocity.y <= config.MAX_UPWARD_VELOCITY) return;
    velocity.y = config.MAX_UPWARD_VELOCITY;
  }

  private updateHorizontalMovement(delta: number) {
    const isForward = inputManager.isForward();
    const isBackward = inputManager.isBackward();
    const isLeftward = inputManager.isLeftward();
    const isRightward = inputManager.isRightward();

    const turnSpeed = 2; // radians/sec
    if (isLeftward) this.yawInRadians += turnSpeed * delta;
    if (isRightward) this.yawInRadians -= turnSpeed * delta;

    this.forwardVec.copy(config.FORWARD).applyQuaternion(this.yawQuaternion);

    this.torqueAxis.crossVectors(config.UP, this.forwardVec).normalize();

    this.newLinVel.copy(this.rigidBody.linvel());
    this.newAngVel.copy(this.rigidBody.angvel());

    const linVelScale = config.LIN_VEL_STRENGTH * delta;
    const angVelScale = config.ANG_VEL_STRENGTH * delta;

    if (isForward) {
      this.newLinVel.addScaledVector(this.forwardVec, linVelScale);
      this.newAngVel.addScaledVector(this.torqueAxis, angVelScale);
    }
    if (isBackward) {
      this.newLinVel.addScaledVector(this.forwardVec, -linVelScale);
      this.newAngVel.addScaledVector(this.torqueAxis, -angVelScale);
    }

    this.rigidBody.setLinvel(this.newLinVel, true);
    this.rigidBody.setAngvel(this.newAngVel, true);

    this.syncMeshWithBody();
  }

  private syncMeshWithBody() {
    this.mesh.position.copy(this.rigidBody.translation());
    this.mesh.quaternion.copy(this.rigidBody.rotation());
  }

  private updateCameraPosition(delta: number) {
    // Rotate desired camera pos
    this.desiredCameraPosition
      .copy(config.CAMERA_OFFSET)
      .applyQuaternion(this.yawQuaternion)
      .add(this.mesh.position);

    // Lerp
    const lerpFactor = config.CAMERA_LERP_FACTOR * delta;
    this.smoothedCameraPosition.lerp(this.desiredCameraPosition, lerpFactor);

    // Lerp target as well
    this.desiredTargetPosition.copy(this.mesh.position);
    this.desiredTargetPosition.y += 1;
    this.smoothedCameraTarget.lerp(this.desiredTargetPosition, lerpFactor);

    // Assign to camera
    sceneManager.camera.position.copy(this.smoothedCameraPosition);
    sceneManager.camera.lookAt(this.smoothedCameraTarget);
  }

  get position() {
    return this.mesh.position;
  }

  get yaw() {
    return this.yawInRadians;
  }
}

class PlayerMaterial extends MeshLambertNodeMaterial {
  private _uniforms: {
    uTime: UniformType<number>;
    uOffsetShadow: UniformType<number>;
  };
  constructor(uniforms: {
    uTime: UniformType<number>;
    uOffsetShadow: UniformType<number>;
  }) {
    super();
    this._uniforms = { ...uniforms };
    this.createMaterial();
  }

  private createMaterial() {
    this.flatShading = true;

    this.castShadowNode = vec3(0.6);

    const mapUv = tslUtils.computeMapUvByPosition(positionWorld.xz);
    const vMapUv = varying(mapUv);
    const shadowFactor = lighting.getTerrainShadowFactor(vMapUv);

    const noiseValue = texture(
      assetManager.noiseTexture,
      fract(positionWorld.xz),
      3,
    ).r;

    const timer = sin(this._uniforms.uTime.mul(2.5).add(noiseValue.mul(5))).mul(
      0.05,
    );

    const waterLevel = float(-0.15).add(timer);

    const underwaterFactor = float(1).sub(step(waterLevel, positionWorld.y));
    const abovewaterFactor = float(1).sub(underwaterFactor);

    const baseColor = vec3(1);

    const tintStrength = float(1).sub(
      smoothstep(-1.5, 1, positionWorld.y).mul(underwaterFactor),
    );

    // Underwater tint (soft blue-green, slightly darker)
    const underwaterTint = mix(
      vec3(1),
      vec3(0.6, 0.8, 1.0).mul(0.75),
      tintStrength,
    );

    // Blend base color with tint based on depth
    const underwaterColor = baseColor.mul(underwaterTint).mul(underwaterFactor);
    const aboveWaterColor = baseColor.mul(abovewaterFactor);

    const tintedColor = aboveWaterColor.add(underwaterColor);

    // Apply baked shadows
    this.colorNode = tintedColor.mul(shadowFactor);
  }
}
