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
import { RevoColliderType } from "../../types";
import {
  assetManager,
  eventsManager,
  inputManager,
  lightingManager,
  physicsManager,
  sceneManager,
} from "../../systems";
import { playerConfig as config } from "./config";
import { PlayerCamera } from "./PlayerCamera";
import { PlayerVisual } from "./PlayerVisual";
import { PlayerWater } from "./PlayerWater";
import { PlayerMaterial, playerUniforms } from "./PlayerMaterial";
import { debugPlayer } from "./debug";

const ZERO_VELOCITY = { x: 0, y: 0, z: 0 };

export default class Player {
  private mesh: Mesh;
  private visualRoot: Object3D;
  private rigidBody: RigidBody;
  private collider: Collider;

  private camera = new PlayerCamera();
  private visual: PlayerVisual;
  private water: PlayerWater;

  private yawInRadians = 0;
  private yawQuaternion = new Quaternion();
  private newLinVel = new Vector3();
  private newAngVel = new Vector3();
  private forwardVec = new Vector3();
  private jumpImpulse = new Vector3();
  private bodyPosition = new Vector3();
  private rayOrigin = new Vector3();
  private ray = new Ray(this.rayOrigin, config.DOWN);

  private isOnGround = false;
  private jumpsRemaining = 0;
  private wasJumpHeld = false;
  private jumpBufferTimer = 0;
  private groundingLockTimer = 0;

  constructor() {
    this.mesh = this.createCharacterMesh();
    this.visualRoot = this.createVisualRoot(this.mesh);
    sceneManager.scene.add(this.visualRoot);

    lightingManager.setTarget(this.visualRoot);

    const rigidBodyDesc = this.createRigidBodyDesc();
    this.rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);
    const colliderDesc = this.createColliderDesc();
    this.collider = physicsManager.world.createCollider(
      colliderDesc,
      this.rigidBody,
    );
    this.collider.userData = { type: RevoColliderType.Player };

    this.visual = new PlayerVisual(this.visualRoot, this.mesh, this.rigidBody);
    this.water = new PlayerWater(this.rigidBody);

    eventsManager.on("engine-before-physics", this.onBeforePhysics);
    eventsManager.on("engine-after-physics", this.onAfterPhysics);
    eventsManager.on("engine-render-update", this.onEngineUpdate);
    eventsManager.on("engine-render-update-throttle-64x", this.onGateUpdate);
    debugPlayer(this.collider);
  }

  private createCharacterMesh() {
    const mesh = assetManager.resources.worldModel.scene.getObjectByName(
      "player",
    ) as Mesh;
    mesh.material = new PlayerMaterial();
    mesh.castShadow = true;
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
      .setLinearDamping(config.LINEAR_DAMPING_IN_INVERSE_SECONDS)
      .setAngularDamping(config.ANGULAR_DAMPING_IN_INVERSE_SECONDS);
  }

  private createColliderDesc() {
    // Average combine keeps bounces controlled: wood/rock pairs land in the
    // 0.3-0.45 range instead of inheriting the highest coefficient
    return ColliderDesc.ball(config.RADIUS_IN_METERS)
      .setRestitution(config.RESTITUTION)
      .setRestitutionCombineRule(CoefficientCombineRule.Average)
      .setFriction(config.FRICTION)
      .setMass(config.MASS_IN_KILOGRAMS)
      .setActiveEvents(ActiveEvents.COLLISION_EVENTS);
  }

  private onBeforePhysics = (state: State) => {
    const { delta } = state;

    this.bodyPosition.copy(this.rigidBody.translation());
    this.water.update(delta, this.bodyPosition);
    this.updateYaw(delta);
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
      this.forwardVec,
    );
  };

  private onEngineUpdate = (state: State) => {
    const { delta } = state;
    const {
      SPIN_BLUR_START_IN_RADIANS_PER_SECOND: blurStart,
      SPIN_BLUR_FULL_IN_RADIANS_PER_SECOND: blurFull,
    } = config;

    this.visual.interpolate(delta);
    this.camera.update(delta, this.visualRoot.position, this.yawInRadians);

    const { x, y, z } = this.rigidBody.angvel();
    const spinRate = Math.hypot(x, y, z);
    playerUniforms.uSpinFactor.value = MathUtils.smoothstep(
      spinRate,
      blurStart,
      blurFull,
    );
  };

  private onGateUpdate = () => {
    if (this.visualRoot.position.y > config.RESET_Y_IN_METERS) return;

    this.rigidBody.setLinvel(ZERO_VELOCITY, false);
    this.rigidBody.setAngvel(ZERO_VELOCITY, false);
    this.rigidBody.setTranslation(config.PLAYER_INITIAL_POSITION, true);
    this.visual.reset();
    this.camera.snapYaw(this.yawInRadians);
    this.jumpsRemaining = 0;
  };

  private updateVerticalMovement(delta: number) {
    const isJumpKeyPressed = inputManager.isJumpPressed();

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
    const velocity = this.rigidBody.linvel();
    const initialVelocityY = velocity.y;

    this.handleJumpCut(isJumpKeyPressed, velocity);
    if (!this.isOnGround) {
      this.handleFastFall(delta, velocity, physicsManager.world.gravity.y);
    }

    const isSlowBounce =
      Math.abs(velocity.y) <
      config.BOUNCE_SETTLE_VERTICAL_SPEED_IN_METERS_PER_SECOND;
    const shouldSettleBounce =
      this.isOnGround && !isJumpKeyPressed && isSlowBounce;
    if (shouldSettleBounce) velocity.y = 0;

    if (velocity.y === initialVelocityY) return;
    this.rigidBody.setLinvel(velocity, true);
  }

  private checkIfGrounded(): boolean {
    // Cast from just above the sphere's bottom for stable grounding.
    this.rayOrigin.copy(this.rigidBody.translation());
    this.rayOrigin.y -=
      config.RADIUS_IN_METERS - config.GROUND_RAY_START_ABOVE_BOTTOM_IN_METERS;
    const hit = physicsManager.world.castRay(
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

  private canJump(): boolean {
    // deep water has no jumps, but a grounded ball in the shallows should
    // still respond
    if (this.water.isInWater && !this.isOnGround) return false;
    return this.jumpsRemaining > 0;
  }

  private performJump() {
    const isGroundJump = this.jumpsRemaining === config.MAX_JUMPS;
    let jumpVelocity = config.DOUBLE_JUMP_VELOCITY_IN_METERS_PER_SECOND;
    if (isGroundJump) jumpVelocity = config.JUMP_VELOCITY_IN_METERS_PER_SECOND;

    const velocityChange = Math.max(
      0,
      jumpVelocity - this.rigidBody.linvel().y,
    );
    this.jumpImpulse.set(0, velocityChange * config.MASS_IN_KILOGRAMS, 0);
    this.rigidBody.applyImpulse(this.jumpImpulse, true);

    this.visual.noteJump();
    this.jumpsRemaining -= 1;
    this.groundingLockTimer = config.JUMP_GROUNDING_LOCK_TIME_IN_SECONDS;
    this.isOnGround = false;
  }

  private handleJumpCut(isJumpKeyPressed: boolean, velocity: Vector) {
    const justReleasedJump = !isJumpKeyPressed && this.wasJumpHeld;
    if (!justReleasedJump || velocity.y <= 0) return;
    velocity.y *= config.JUMP_CUT_MULTIPLIER;
  }

  private handleFastFall(delta: number, velocity: Vector, gravityY: number) {
    if (velocity.y >= 0) return;
    velocity.y -= config.FALL_MULTIPLIER * Math.abs(gravityY) * delta;
  }

  private updateYaw(delta: number) {
    const { TURN_SPEED_IN_RADIANS_PER_SECOND: turnSpeed } = config;

    if (inputManager.isLeftward()) this.yawInRadians += turnSpeed * delta;
    if (inputManager.isRightward()) this.yawInRadians -= turnSpeed * delta;

    this.yawQuaternion.setFromAxisAngle(config.UP, this.yawInRadians);
    this.forwardVec.copy(config.FORWARD).applyQuaternion(this.yawQuaternion);
  }

  private getMovementMultiplier() {
    if (this.water.isInWater) return config.WATER_MOVEMENT_MULTIPLIER;
    if (this.isOnGround) return 1;
    return config.AIR_CONTROL_FACTOR;
  }

  private updateHorizontalMovement(delta: number) {
    const isForward = inputManager.isForward();
    const isBackward = inputManager.isBackward();
    if (!isForward && !isBackward) return;

    const {
      LIN_VEL_STRENGTH_IN_METERS_PER_SECOND_SQUARED: acceleration,
      MAX_SPEED_IN_METERS_PER_SECOND: maxSpeed,
      RADIUS_IN_METERS: radius,
    } = config;

    const driveSign = Number(isForward) - Number(isBackward);
    const linVelScale = acceleration * delta * this.getMovementMultiplier();

    this.newLinVel.copy(this.rigidBody.linvel());
    this.newLinVel.addScaledVector(this.forwardVec, linVelScale * driveSign);

    const horizontalSpeed = Math.hypot(this.newLinVel.x, this.newLinVel.z);
    if (horizontalSpeed > maxSpeed) {
      const scale = maxSpeed / horizontalSpeed;
      this.newLinVel.x *= scale;
      this.newLinVel.z *= scale;
    }
    this.rigidBody.setLinvel(this.newLinVel, true);

    if (!this.isOnGround && !this.water.isInWater) return;

    // spin follows actual motion (omega = up x v / r) instead of being its
    // own motor, so excess spin can never grip the ball up trees or walls;
    // airborne spin stays natural. While braking, spin follows the input
    // direction instead — backward spin while still sliding forward (drift);
    // magnitude stays tied to the current speed, so no wall traction
    const alongForward =
      this.newLinVel.x * this.forwardVec.x +
      this.newLinVel.z * this.forwardVec.z;
    const isDrifting = driveSign !== 0 && alongForward * driveSign < 0;

    if (isDrifting) {
      const driftSpin =
        (driveSign * Math.abs(alongForward) * config.DRIFT_SPIN_MULTIPLIER) /
        radius;
      this.newAngVel
        .crossVectors(config.UP, this.forwardVec)
        .multiplyScalar(driftSpin);
    } else {
      this.newAngVel
        .crossVectors(config.UP, this.newLinVel)
        .divideScalar(radius);
    }
    this.rigidBody.setAngvel(this.newAngVel, true);
  }

  get position() {
    return this.visualRoot.position;
  }

  get radius() {
    return config.RADIUS_IN_METERS;
  }
}
