import { MathUtils, Mesh, Object3D, Vector3, Quaternion } from "three";
import {
  Collider,
  ColliderDesc,
  RigidBody,
  RigidBodyDesc,
  Ray,
  type Vector,
  ActiveEvents,
  CoefficientCombineRule,
} from "@dimforge/rapier3d";
import { type State } from "../../Game";
import { RevoColliderType } from "../../systems/physics/colliderTypes";
import {
  assets,
  eventBus,
  input,
  lighting,
  physicsWorld,
  physicsScheduler,
  stage,
  graphics,
} from "../../systems";
import { playerConfig as config } from "./config";
import { DOWN, FORWARD, UP } from "../axes";
import { PlayerCamera } from "./PlayerCamera";
import { PlayerVisual } from "./PlayerVisual";
import { PlayerWater } from "./PlayerWater";
import { PlayerMaterial, playerUniforms } from "./PlayerMaterial";
import { debugPlayer } from "./debug";

const ZERO_VELOCITY = { x: 0, y: 0, z: 0 };

export class Player {
  private mesh: Mesh;
  private visualRoot: Object3D;
  private rigidBody: RigidBody;
  private collider: Collider;

  private camera = new PlayerCamera(stage.playerCamera);
  private visual: PlayerVisual;
  private water: PlayerWater;

  private yawInRadians = 0;
  private previousYawInRadians = 0;
  private yawQuaternion = new Quaternion();
  private linearVelocity = new Vector3();
  private angularVelocity = new Vector3();
  private forwardDirection = new Vector3();
  private jumpImpulse = new Vector3();
  private bodyPosition = new Vector3();
  private rayOrigin = new Vector3();
  private ray = new Ray(this.rayOrigin, DOWN);

  private isOnGround = false;
  private jumpsRemaining = 0;
  private wasJumpHeld = false;
  private jumpBufferTimer = 0;
  private groundingLockTimer = 0;

  constructor() {
    this.mesh = this.createCharacterMesh();
    this.visualRoot = this.createVisualRoot(this.mesh);
    stage.mainScene.add(this.visualRoot);
    graphics.vsmPass.registerCaster(this.mesh, { type: "dynamic" });

    const rigidBodyDesc = this.createRigidBodyDesc();
    this.rigidBody = physicsWorld.world.createRigidBody(rigidBodyDesc);
    const colliderDesc = this.createColliderDesc();
    this.collider = physicsWorld.world.createCollider(
      colliderDesc,
      this.rigidBody,
    );
    this.collider.userData = { type: RevoColliderType.Player };

    this.visual = new PlayerVisual(this.visualRoot, this.mesh, this.rigidBody);
    this.water = new PlayerWater(this.rigidBody);

    eventBus.on("engine-before-physics", this.onBeforePhysics);
    eventBus.on("engine-after-physics", this.onAfterPhysics);
    eventBus.on("engine-render-update", this.onEngineUpdate);
    eventBus.on("engine-render-update-throttle-64x", this.onFallCheck);
    // light tracking must run after visual interpolation
    lighting.setTarget(this.visualRoot);
    debugPlayer(this.collider);
  }

  private createCharacterMesh() {
    const mesh = assets.getMesh("player");
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

  private createRigidBodyDesc() {
    const { x, y, z } = config.PLAYER_INITIAL_POSITION;
    return RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setAngularDamping(config.ANGULAR_DAMPING_IN_INVERSE_SECONDS);
  }

  private createColliderDesc() {
    // average combine keeps bounces controlled: wood and rock pairs land in
    // the 0.3 to 0.45 range instead of inheriting the highest coefficient.
    // no grip on obstacles or the roll spin climbs them, terrain overrides with max
    return ColliderDesc.ball(config.RADIUS_IN_METERS)
      .setRestitution(config.RESTITUTION)
      .setRestitutionCombineRule(CoefficientCombineRule.Average)
      .setFriction(config.FRICTION)
      .setFrictionCombineRule(CoefficientCombineRule.Min)
      .setMass(config.MASS_IN_KILOGRAMS)
      .setActiveEvents(ActiveEvents.COLLISION_EVENTS);
  }

  private onBeforePhysics = (state: State) => {
    const { delta } = state;

    this.rigidBody.translation(this.bodyPosition);
    this.water.update(delta, this.bodyPosition);
    this.updateYaw(delta);
    this.applyHorizontalDamping(delta);
    this.updateVerticalMovement(delta);
    this.updateHorizontalMovement(delta);
  };

  private onAfterPhysics = (state: State) => {
    const { delta } = state;

    this.isOnGround = this.groundingLockTimer === 0 && this.checkIfGrounded();
    this.visual.capture(
      delta,
      this.isOnGround,
      this.water.isInWater,
      this.forwardDirection,
    );
  };

  private onEngineUpdate = (state: State) => {
    const { delta } = state;
    const {
      SPIN_BLUR_START_IN_RADIANS_PER_SECOND: blurStart,
      SPIN_BLUR_FULL_IN_RADIANS_PER_SECOND: blurFull,
    } = config;

    this.visual.interpolate(delta);
    const yawOffset = this.yawInRadians - this.previousYawInRadians;
    const shortestYawOffset = Math.atan2(
      Math.sin(yawOffset),
      Math.cos(yawOffset),
    );
    const interpolatedYaw =
      this.previousYawInRadians + shortestYawOffset * physicsScheduler.alpha;
    this.camera.update(delta, this.visualRoot.position, interpolatedYaw);
    stage.syncPlayerCameraUniforms();

    this.rigidBody.angvel(this.angularVelocity);
    const spinRate = this.angularVelocity.length();
    playerUniforms.uSpinFactor.value = MathUtils.smoothstep(
      spinRate,
      blurStart,
      blurFull,
    );
    playerUniforms.uPosition.value.copy(this.visualRoot.position);
  };

  private onFallCheck = () => {
    if (this.visualRoot.position.y > config.RESET_Y_IN_METERS) return;

    this.rigidBody.setLinvel(ZERO_VELOCITY, false);
    this.rigidBody.setAngvel(ZERO_VELOCITY, false);
    this.rigidBody.setTranslation(config.PLAYER_INITIAL_POSITION, true);
    this.visual.reset();
    this.camera.snapYaw(this.yawInRadians);
    this.jumpsRemaining = 0;
  };

  private updateVerticalMovement(delta: number) {
    const isJumpKeyPressed = input.isJumpPressed();

    this.groundingLockTimer = Math.max(0, this.groundingLockTimer - delta);
    this.isOnGround = this.groundingLockTimer === 0 && this.checkIfGrounded();

    // jumps refill only on real ground contact and never while airborne, so
    // double jumps can't be chained upward indefinitely
    if (this.isOnGround) this.jumpsRemaining = config.MAX_JUMPS;

    const justPressedThisFrame = isJumpKeyPressed && !this.wasJumpHeld;
    if (justPressedThisFrame) {
      this.jumpBufferTimer = config.JUMP_BUFFER_DURATION_IN_SECONDS;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - delta);
    }

    if (this.jumpBufferTimer > 0 && this.canJump()) {
      this.performJump();
      this.jumpBufferTimer = 0;
    }

    if (!this.water.isInWater) {
      this.updateVerticalVelocity(delta, isJumpKeyPressed);
    }
    this.wasJumpHeld = isJumpKeyPressed;
  }

  private updateVerticalVelocity(delta: number, isJumpKeyPressed: boolean) {
    const { linearVelocity } = this;
    this.rigidBody.linvel(linearVelocity);
    const initialVelocityY = linearVelocity.y;

    this.applyJumpCut(isJumpKeyPressed, linearVelocity);
    if (!this.isOnGround) {
      this.applyAirGravity(delta, linearVelocity, physicsWorld.world.gravity.y);
    }

    const isSlowBounce =
      Math.abs(linearVelocity.y) <
      config.BOUNCE_SETTLE_VERTICAL_SPEED_IN_METERS_PER_SECOND;
    const shouldSettleBounce =
      this.isOnGround && !isJumpKeyPressed && isSlowBounce;
    if (shouldSettleBounce) linearVelocity.y = 0;

    if (linearVelocity.y === initialVelocityY) return;
    this.rigidBody.setLinvel(linearVelocity, true);
  }

  private checkIfGrounded() {
    // cast from just above the bottom of the sphere for stable grounding
    this.rigidBody.translation(this.rayOrigin);
    this.rayOrigin.y -=
      config.RADIUS_IN_METERS - config.GROUND_RAY_START_ABOVE_BOTTOM_IN_METERS;
    const hit = physicsWorld.world.castRay(
      this.ray,
      config.GROUND_RAY_MAX_DISTANCE_IN_METERS,
      true,
      undefined,
      undefined,
      undefined,
      this.rigidBody,
    );
    if (!hit) return false;
    return hit.timeOfImpact <= config.GROUND_CONTACT_THRESHOLD_IN_METERS;
  }

  private canJump() {
    // deep water has no jumps, but a grounded ball in the shallows should
    // still respond
    if (this.water.isInWater && !this.isOnGround) return false;
    return this.jumpsRemaining > 0;
  }

  private performJump() {
    const isGroundJump = this.jumpsRemaining === config.MAX_JUMPS;
    let jumpVelocity = config.DOUBLE_JUMP_VELOCITY_IN_METERS_PER_SECOND;
    if (isGroundJump) jumpVelocity = config.JUMP_VELOCITY_IN_METERS_PER_SECOND;

    this.rigidBody.linvel(this.linearVelocity);
    const velocityChange = Math.max(0, jumpVelocity - this.linearVelocity.y);
    this.jumpImpulse.set(0, velocityChange * config.MASS_IN_KILOGRAMS, 0);
    this.rigidBody.applyImpulse(this.jumpImpulse, true);

    this.visual.noteJump();
    this.jumpsRemaining -= 1;
    this.groundingLockTimer = config.JUMP_GROUNDING_LOCK_TIME_IN_SECONDS;
    this.isOnGround = false;
  }

  private applyJumpCut(isJumpKeyPressed: boolean, velocity: Vector) {
    const justReleasedJump = !isJumpKeyPressed && this.wasJumpHeld;
    if (!justReleasedJump || velocity.y <= 0) return;
    velocity.y *= config.JUMP_CUT_MULTIPLIER;
  }

  private applyAirGravity(delta: number, velocity: Vector, gravityY: number) {
    let gravityMultiplier = config.RISE_GRAVITY_MULTIPLIER;
    if (velocity.y < 0) gravityMultiplier = config.FALL_GRAVITY_MULTIPLIER;
    // the world already applies gravity once
    velocity.y -= (gravityMultiplier - 1) * Math.abs(gravityY) * delta;
  }

  private applyHorizontalDamping(delta: number) {
    if (this.water.isInWater) return;
    const { linearVelocity } = this;
    this.rigidBody.linvel(linearVelocity);
    // damping vertical speed too made jumps pop and then hang at the apex
    const damping = Math.exp(
      -config.HORIZONTAL_DAMPING_IN_INVERSE_SECONDS * delta,
    );
    linearVelocity.x *= damping;
    linearVelocity.z *= damping;
    this.rigidBody.setLinvel(linearVelocity, false);
  }

  private updateYaw(delta: number) {
    const { TURN_SPEED_IN_RADIANS_PER_SECOND: turnSpeed } = config;

    this.previousYawInRadians = this.yawInRadians;
    if (input.isLeftward()) this.yawInRadians += turnSpeed * delta;
    if (input.isRightward()) this.yawInRadians -= turnSpeed * delta;

    this.yawQuaternion.setFromAxisAngle(UP, this.yawInRadians);
    this.forwardDirection.copy(FORWARD).applyQuaternion(this.yawQuaternion);
  }

  private getMovementMultiplier() {
    if (this.water.isInWater) return config.WATER_MOVEMENT_MULTIPLIER;
    if (this.isOnGround) return 1;
    return config.AIR_CONTROL_FACTOR;
  }

  private updateHorizontalMovement(delta: number) {
    const isForward = input.isForward();
    const isBackward = input.isBackward();
    if (!isForward && !isBackward) return;

    const {
      ACCELERATION_IN_METERS_PER_SECOND_SQUARED: acceleration,
      MAX_SPEED_IN_METERS_PER_SECOND: maxSpeed,
      RADIUS_IN_METERS: radius,
    } = config;
    const { linearVelocity, angularVelocity, forwardDirection } = this;

    const driveSign = Number(isForward) - Number(isBackward);
    const velocityGain = acceleration * delta * this.getMovementMultiplier();

    this.rigidBody.linvel(linearVelocity);
    linearVelocity.addScaledVector(forwardDirection, velocityGain * driveSign);

    const horizontalSpeedSquared =
      linearVelocity.x ** 2 + linearVelocity.z ** 2;
    if (horizontalSpeedSquared > maxSpeed ** 2) {
      const scale = maxSpeed / Math.sqrt(horizontalSpeedSquared);
      linearVelocity.x *= scale;
      linearVelocity.z *= scale;
    }
    this.rigidBody.setLinvel(linearVelocity, true);

    if (!this.isOnGround && !this.water.isInWater) return;

    // spin follows the motion (up x v / r) so it never acts as its own motor.
    // braking spins against the slide for a drift, at the same speed so it
    // still has no wall traction
    const forwardSpeed =
      linearVelocity.x * forwardDirection.x +
      linearVelocity.z * forwardDirection.z;
    const isDrifting = driveSign !== 0 && forwardSpeed * driveSign < 0;

    if (isDrifting) {
      const driftSpin =
        (driveSign * Math.abs(forwardSpeed) * config.DRIFT_SPIN_MULTIPLIER) /
        radius;
      angularVelocity
        .crossVectors(UP, forwardDirection)
        .multiplyScalar(driftSpin);
    } else {
      angularVelocity.crossVectors(UP, linearVelocity).divideScalar(radius);
    }
    this.rigidBody.setAngvel(angularVelocity, true);
  }

  get position() {
    return this.visualRoot.position;
  }

  get yaw() {
    return this.yawInRadians;
  }

  get radius() {
    return config.RADIUS_IN_METERS;
  }
}
