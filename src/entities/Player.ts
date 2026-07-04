import { MathUtils, Mesh, Object3D, Vector3, Quaternion } from "three";
import {
  ColliderDesc,
  RigidBody,
  RigidBodyDesc,
  Ray,
  type Vector,
  ActiveEvents,
  CoefficientCombineRule,
} from "@dimforge/rapier3d";
import { type State } from "../Game";
import {
  float,
  mix,
  normalMap,
  positionWorld,
  texture,
  uv,
  vec3,
} from "three/tsl";
import { MeshLambertNodeMaterial } from "three/webgpu";
import { RevoColliderType } from "../types";
import {
  assetManager,
  debugManager,
  eventsManager,
  inputManager,
  lightingManager,
  physicsManager,
  sceneManager,
} from "../systems";
import { TSLUtils } from "../utils/TSLUtils";
import { realmConfig } from "../realm/config";

const POSITIONS = {
  center: [0, 0.5, 10],
  berserk: [180, 0.5, -150],
  hill: [-100, 0.5, 240],
  campfire: [-165, 0.5, -150],
  gow: [70, 0.5, 125],
  lake: [-222.5, 0.5, 170],
  dragonball: [150, 0.5, 80],
};

const getConfig = () => {
  return {
    JUMP_BUFFER_DURATION_IN_SECONDS: 0.2,
    COYOTE_TIME_IN_SECONDS: 0.1,
    MAX_CONSECUTIVE_JUMPS: 2,
    JUMP_VELOCITY_IN_METERS_PER_SECOND: 6,
    DOUBLE_JUMP_VELOCITY_IN_METERS_PER_SECOND: 8,
    JUMP_CUT_MULTIPLIER: 0.62,
    JUMP_GROUNDING_LOCK_TIME_IN_SECONDS: 0.08,
    FALL_MULTIPLIER: 2.05,

    LINEAR_DAMPING_IN_INVERSE_SECONDS: 1.15,
    ANGULAR_DAMPING_IN_INVERSE_SECONDS: 0.5,
    RADIUS_IN_METERS: 0.5,
    MASS_IN_KILOGRAMS: 0.5,
    FRICTION: 1,
    RESTITUTION: 0.52,

    WATER_SURFACE_Y_IN_METERS: -0.5,
    WATER_DAMPING_LINEAR_IN_INVERSE_SECONDS: 5.0,
    WATER_DAMPING_ANGULAR_IN_INVERSE_SECONDS: 3.5,
    WATER_MOVEMENT_MULTIPLIER: 0.5,
    BUOYANCY_FORCE_IN_NEWTONS: 7.25,
    WATER_VERTICAL_DAMPING_IN_INVERSE_SECONDS: 0.5,
    WATER_BOB_FORCE_IN_NEWTONS: 2.5,

    GROUND_RAY_START_ABOVE_BOTTOM_IN_METERS: 0.03,
    GROUND_RAY_MAX_DISTANCE_IN_METERS: 0.1,
    GROUND_CONTACT_THRESHOLD_IN_METERS: 0.04,
    BOUNCE_SETTLE_VERTICAL_SPEED_IN_METERS_PER_SECOND: 0.85,

    LIN_VEL_STRENGTH_IN_METERS_PER_SECOND_SQUARED: 50,
    ANG_VEL_STRENGTH_IN_RADIANS_PER_SECOND_SQUARED: 55,
    TURN_SPEED_IN_RADIANS_PER_SECOND: 2,

    ACCELERATION_SQUASH_STRENGTH: 0.018,
    JUMP_STRETCH_STRENGTH: 0.5,
    LANDING_SQUASH_STRENGTH: 0.12,
    IMPACT_SQUASH_STRENGTH: 0.08,
    GROUND_SPEED_SQUASH_STRENGTH: 0.003,
    SQUASH_RECOVERY_SPEED_IN_INVERSE_SECONDS: 14,
    MAX_SQUASH_DEFORMATION: 0.4,
    WATER_SQUASH_MULTIPLIER: 0.25,

    PLAYER_INITIAL_POSITION: new Vector3(...POSITIONS.campfire),
    CAMERA_OFFSET: new Vector3(0, 16, 20),
    CAMERA_LERP_FACTOR: 7.5,
    UP: new Vector3(0, 1, 0),
    DOWN: new Vector3(0, -1, 0),
    FORWARD: new Vector3(0, 0, -1),
    RESET_Y_IN_METERS: -15,
  };
};

const config = getConfig();

type WaterMask = {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
};

export default class Player {
  private mesh: Mesh;
  private visualRoot: Object3D;
  private rigidBody: RigidBody;

  private smoothedCameraPosition = new Vector3();
  private desiredCameraPosition = new Vector3();
  private smoothedCameraTarget = new Vector3();
  private desiredTargetPosition = new Vector3();

  private yawInRadians = 0;
  private yawQuaternion = new Quaternion();
  private newLinVel = new Vector3();
  private newAngVel = new Vector3();
  private torqueAxis = new Vector3();
  private forwardVec = new Vector3();
  private jumpImpulse = new Vector3();
  private currentVelocity = new Vector3();
  private previousVelocity = new Vector3();
  private velocityDelta = new Vector3();
  private horizontalVelocity = new Vector3();
  private rayOrigin = new Vector3();
  private ray = new Ray(this.rayOrigin, config.DOWN);
  private prevPosition = new Vector3();
  private prevQuaternion = new Quaternion();
  private targetPosition = new Vector3();
  private targetQuaternion = new Quaternion();
  private bodyQuaternion = new Quaternion();

  private isOnGround = false;
  private jumpCount = 0;
  private wasJumpHeld = false;
  private jumpBufferTimer = 0;
  private coyoteTimer = 0;
  private groundingLockTimer = 0;

  private isInWater = false;
  private waterMask: WaterMask | null = null;
  private waterTime = 0;
  private waterImpulse = new Vector3();

  private deformationDirection = new Vector3(0, 0, -1);
  private squashQuaternion = new Quaternion();
  private targetSquashQuaternion = new Quaternion();
  private inverseSquashQuaternion = new Quaternion();
  private squashScale = new Vector3(1, 1, 1);
  private targetSquashScale = new Vector3(1, 1, 1);
  private jumpStretchImpulse = 0;
  private landingSquashImpulse = 0;
  private impactSquashImpulse = 0;

  constructor() {
    this.mesh = this.createCharacterMesh();
    this.visualRoot = this.createVisualRoot(this.mesh);
    sceneManager.scene.add(this.visualRoot);

    lightingManager.setTarget(this.visualRoot);

    const rigidBodyDesc = this.createRigidBodyDesc();
    this.rigidBody = physicsManager.world.createRigidBody(rigidBodyDesc);
    const colliderDesc = this.createColliderDesc();
    const collider = physicsManager.world.createCollider(
      colliderDesc,
      this.rigidBody,
    );
    collider.userData = { type: RevoColliderType.Player };

    this.prevPosition.copy(this.rigidBody.translation());
    this.prevQuaternion.copy(this.rigidBody.rotation());
    this.targetPosition.copy(this.prevPosition);
    this.targetQuaternion.copy(this.prevQuaternion);
    this.previousVelocity.copy(this.rigidBody.linvel());

    eventsManager.on("engine-update", this.update.bind(this));
    eventsManager.on(
      "engine-update-throttle-64x",
      this.resetPlayerPosition.bind(this),
    );
    this.loadWaterMask();
    this.debugPlayer();
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
    return ColliderDesc.ball(config.RADIUS_IN_METERS)
      .setRestitution(config.RESTITUTION)
      .setRestitutionCombineRule(CoefficientCombineRule.Max)
      .setFriction(config.FRICTION)
      .setMass(config.MASS_IN_KILOGRAMS)
      .setActiveEvents(ActiveEvents.COLLISION_EVENTS);
  }

  private update(state: State) {
    const { delta } = state;

    this.updateWaterState(delta);
    this.updateYaw(delta);
    this.updateYawQuaternion();

    const wasOnGround = this.isOnGround;
    this.updateVerticalMovement(delta);
    this.updateHorizontalMovement(delta);
    this.updateSquashState(delta, wasOnGround);
    this.syncMeshWithBody(delta);
    this.updateCameraPosition(delta);
  }

  private updateWaterState(delta: number) {
    const wasInWater = this.isInWater;
    this.isInWater = this.isPlayerInWater();

    if (this.isInWater !== wasInWater) this.applyCurrentDamping();
    if (this.isInWater) this.applyWaterPhysics(delta);
  }

  private applyCurrentDamping() {
    const linearDamping = this.isInWater
      ? config.WATER_DAMPING_LINEAR_IN_INVERSE_SECONDS
      : config.LINEAR_DAMPING_IN_INVERSE_SECONDS;
    this.rigidBody.setLinearDamping(linearDamping);

    const angularDamping = this.isInWater
      ? config.WATER_DAMPING_ANGULAR_IN_INVERSE_SECONDS
      : config.ANGULAR_DAMPING_IN_INVERSE_SECONDS;
    this.rigidBody.setAngularDamping(angularDamping);
  }

  private loadWaterMask() {
    const tex = assetManager.resources.waterMap;
    if (!tex?.image) return;
    const image = tex.image as HTMLImageElement;
    if (!image.width || !image.height) return;
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      this.waterMask = {
        pixels: imageData.data,
        width: canvas.width,
        height: canvas.height,
      };
    } catch {
      return;
    }
  }

  private isPlayerInWater(): boolean {
    if (!this.waterMask) return false;
    const position = this.rigidBody.translation();
    const bottomY = position.y - config.RADIUS_IN_METERS;
    const isAboveWaterSurface = bottomY > config.WATER_SURFACE_Y_IN_METERS;
    if (isAboveWaterSurface) return false;

    const waterMapU =
      (position.x + realmConfig.HALF_MAP_SIZE) / realmConfig.MAP_SIZE;
    const waterMapV =
      (position.z + realmConfig.HALF_MAP_SIZE) / realmConfig.MAP_SIZE;
    const isOutsideWaterMap =
      waterMapU < 0 || waterMapU >= 1 || waterMapV < 0 || waterMapV >= 1;
    if (isOutsideWaterMap) return false;

    const px = Math.floor(waterMapU * this.waterMask.width);
    const py = Math.floor(waterMapV * this.waterMask.height);
    const idx = (py * this.waterMask.width + px) * 4;
    return this.waterMask.pixels[idx] > 128;
  }

  private applyWaterPhysics(delta: number) {
    this.waterTime += delta;

    const position = this.rigidBody.translation();
    const velocity = this.rigidBody.linvel();
    const bottomY = position.y - config.RADIUS_IN_METERS;
    const submergedDepth =
      config.WATER_SURFACE_Y_IN_METERS - bottomY;

    if (submergedDepth <= 0) {
      this.waterTime = 0;
      return;
    }

    const submersionRatio = Math.min(submergedDepth, 1);
    const edgeFade = Math.min(submergedDepth * 2, 1);

    const buoyancy =
      submersionRatio * config.BUOYANCY_FORCE_IN_NEWTONS * edgeFade;
    const verticalDamping =
      velocity.y * -config.WATER_VERTICAL_DAMPING_IN_INVERSE_SECONDS * edgeFade;
    const bob =
      Math.sin(this.waterTime * 4) *
      config.WATER_BOB_FORCE_IN_NEWTONS *
      edgeFade;

    const waterImpulseY = (buoyancy + verticalDamping + bob) * delta;
    this.waterImpulse.set(0, waterImpulseY, 0);
    this.rigidBody.applyImpulse(this.waterImpulse, true);
  }

  private updateVerticalMovement(delta: number) {
    const isJumpKeyPressed = inputManager.isJumpPressed();

    this.groundingLockTimer = Math.max(0, this.groundingLockTimer - delta);
    this.isOnGround = this.groundingLockTimer === 0 && this.checkIfGrounded();

    if (this.isOnGround) {
      this.jumpCount = 0;
      this.coyoteTimer = config.COYOTE_TIME_IN_SECONDS;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - delta);
    }

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

    if (!this.isInWater) {
      const velocity = this.rigidBody.linvel();
      const initialVelocityY = velocity.y;

      this.handleJumpCut(isJumpKeyPressed, velocity);
      if (!this.isOnGround) {
        this.handleFastFall(delta, velocity, physicsManager.world.gravity.y);
      }

      const verticalSpeed = Math.abs(velocity.y);
      const isSlowBounce =
        verticalSpeed < config.BOUNCE_SETTLE_VERTICAL_SPEED_IN_METERS_PER_SECOND;
      const shouldSettleBounce =
        this.isOnGround &&
        !isJumpKeyPressed &&
        isSlowBounce;

      if (shouldSettleBounce) velocity.y = 0;

      const didVerticalVelocityChange = velocity.y !== initialVelocityY;
      if (didVerticalVelocityChange) this.rigidBody.setLinvel(velocity, true);
    }

    this.wasJumpHeld = isJumpKeyPressed;
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
    if (this.isInWater) return false;
    if (this.isOnGround || this.coyoteTimer > 0) return true;
    return this.jumpCount < config.MAX_CONSECUTIVE_JUMPS;
  }

  private performJump() {
    const velocity = this.rigidBody.linvel();
    const jumpVelocity =
      this.jumpCount === 0
        ? config.JUMP_VELOCITY_IN_METERS_PER_SECOND
        : config.DOUBLE_JUMP_VELOCITY_IN_METERS_PER_SECOND;
    const velocityChange = Math.max(0, jumpVelocity - velocity.y);
    this.jumpImpulse.set(0, velocityChange * config.MASS_IN_KILOGRAMS, 0);
    this.rigidBody.applyImpulse(this.jumpImpulse, true);
    this.jumpStretchImpulse = 1;
    this.jumpCount += 1;
    this.coyoteTimer = 0;
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
    const extraDown = config.FALL_MULTIPLIER * Math.abs(gravityY) * delta;
    velocity.y -= extraDown;
  }

  private updateYaw(delta: number) {
    const isLeftward = inputManager.isLeftward();
    const isRightward = inputManager.isRightward();

    if (isLeftward)
      this.yawInRadians += config.TURN_SPEED_IN_RADIANS_PER_SECOND * delta;
    if (isRightward)
      this.yawInRadians -= config.TURN_SPEED_IN_RADIANS_PER_SECOND * delta;
  }

  private updateYawQuaternion() {
    this.yawQuaternion.setFromAxisAngle(config.UP, this.yawInRadians);
    this.forwardVec.copy(config.FORWARD).applyQuaternion(this.yawQuaternion);
  }

  private updateHorizontalMovement(delta: number) {
    const isForward = inputManager.isForward();
    const isBackward = inputManager.isBackward();
    const hasDriveInput = isForward || isBackward;
    if (!hasDriveInput) return;

    this.torqueAxis.crossVectors(config.UP, this.forwardVec).normalize();

    this.newLinVel.copy(this.rigidBody.linvel());
    this.newAngVel.copy(this.rigidBody.angvel());

    const movementMultiplier = this.isInWater
      ? config.WATER_MOVEMENT_MULTIPLIER
      : 1;
    const linVelScale =
      config.LIN_VEL_STRENGTH_IN_METERS_PER_SECOND_SQUARED *
      delta *
      movementMultiplier;
    const angVelScale =
      config.ANG_VEL_STRENGTH_IN_RADIANS_PER_SECOND_SQUARED *
      delta *
      movementMultiplier;

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
  }

  private updateSquashState(delta: number, wasOnGround: boolean) {
    this.currentVelocity.copy(this.rigidBody.linvel());
    this.velocityDelta.subVectors(this.currentVelocity, this.previousVelocity);
    this.horizontalVelocity.set(
      this.currentVelocity.x,
      0,
      this.currentVelocity.z,
    );

    const didLand = !wasOnGround && this.isOnGround;
    if (didLand) {
      const landingSpeed = Math.max(0, -this.previousVelocity.y);
      const landingImpulse = MathUtils.clamp(
        landingSpeed / config.JUMP_VELOCITY_IN_METERS_PER_SECOND,
        0,
        1,
      );
      this.landingSquashImpulse = Math.max(
        this.landingSquashImpulse,
        landingImpulse,
      );
    }

    if (this.isOnGround) {
      const impactStrength = (this.velocityDelta.length() - 1.4) * 0.25;
      const impactImpulse = MathUtils.clamp(impactStrength, 0, 1);
      this.impactSquashImpulse = Math.max(
        this.impactSquashImpulse,
        impactImpulse,
      );
    }

    this.updateSquashTarget(delta);
    this.previousVelocity.copy(this.currentVelocity);
  }

  private updateSquashTarget(delta: number) {
    const squashMultiplier = this.isInWater
      ? config.WATER_SQUASH_MULTIPLIER
      : 1;
    const horizontalSpeed = this.horizontalVelocity.length();
    const horizontalAcceleration = Math.hypot(
      this.velocityDelta.x,
      this.velocityDelta.z,
    );
    const accelerationStretch =
      horizontalAcceleration *
      config.ACCELERATION_SQUASH_STRENGTH *
      squashMultiplier;
    const jumpStretch =
      this.jumpStretchImpulse * config.JUMP_STRETCH_STRENGTH * squashMultiplier;
    const landingSquash =
      this.landingSquashImpulse *
      config.LANDING_SQUASH_STRENGTH *
      squashMultiplier;
    const impactSquash =
      this.impactSquashImpulse *
      config.IMPACT_SQUASH_STRENGTH *
      squashMultiplier;
    const speedSquash =
      (this.isOnGround ? horizontalSpeed : 0) *
      config.GROUND_SPEED_SQUASH_STRENGTH *
      squashMultiplier;
    const squash = landingSquash + impactSquash + speedSquash;

    const squashScaleX =
      1 - accelerationStretch * 0.5 - jumpStretch * 0.45 + squash * 0.5;
    const squashScaleY = 1 - accelerationStretch * 0.25 + jumpStretch - squash;
    const squashScaleZ =
      1 + accelerationStretch - jumpStretch * 0.45 + squash * 0.5;
    this.targetSquashScale.set(squashScaleX, squashScaleY, squashScaleZ);
    this.clampSquashScale();
    this.updateSquashDirection(horizontalSpeed);
    this.decaySquashImpulses(delta);
  }

  private updateSquashDirection(horizontalSpeed: number) {
    if (horizontalSpeed > 0.05) {
      this.deformationDirection.copy(this.horizontalVelocity).normalize();
    } else {
      this.deformationDirection.copy(this.forwardVec);
    }

    this.targetSquashQuaternion.setFromUnitVectors(
      config.FORWARD,
      this.deformationDirection,
    );
  }

  private clampSquashScale() {
    const minScale = 1 - config.MAX_SQUASH_DEFORMATION;
    const maxScale = 1 + config.MAX_SQUASH_DEFORMATION;
    const x = MathUtils.clamp(this.targetSquashScale.x, minScale, maxScale);
    const y = MathUtils.clamp(this.targetSquashScale.y, minScale, maxScale);
    const z = MathUtils.clamp(this.targetSquashScale.z, minScale, maxScale);

    this.targetSquashScale.set(x, y, z);
  }

  private decaySquashImpulses(delta: number) {
    const decay = Math.exp(
      -config.SQUASH_RECOVERY_SPEED_IN_INVERSE_SECONDS * delta,
    );
    this.jumpStretchImpulse *= decay;
    this.landingSquashImpulse *= decay;
    this.impactSquashImpulse *= decay;
  }

  private syncMeshWithBody(delta: number) {
    if (physicsManager.didStep) {
      this.prevPosition.copy(this.targetPosition);
      this.prevQuaternion.copy(this.targetQuaternion);
      this.targetPosition.copy(this.rigidBody.translation());
      this.targetQuaternion.copy(this.rigidBody.rotation());
    }

    this.visualRoot.position.lerpVectors(
      this.prevPosition,
      this.targetPosition,
      physicsManager.alpha,
    );
    this.bodyQuaternion.slerpQuaternions(
      this.prevQuaternion,
      this.targetQuaternion,
      physicsManager.alpha,
    );
    this.applySquashTransform(delta);
  }

  private applySquashTransform(delta: number) {
    const t =
      1 - Math.exp(-config.SQUASH_RECOVERY_SPEED_IN_INVERSE_SECONDS * delta);
    this.squashScale.lerp(this.targetSquashScale, t);
    this.squashQuaternion.slerp(this.targetSquashQuaternion, t);

    this.visualRoot.scale.copy(this.squashScale);
    this.visualRoot.quaternion.copy(this.squashQuaternion);
    this.inverseSquashQuaternion.copy(this.squashQuaternion).invert();
    this.mesh.quaternion
      .copy(this.inverseSquashQuaternion)
      .multiply(this.bodyQuaternion);
  }

  private updateCameraPosition(delta: number) {
    this.desiredCameraPosition
      .copy(config.CAMERA_OFFSET)
      .applyQuaternion(this.yawQuaternion)
      .add(this.visualRoot.position);

    const lerpFactor = config.CAMERA_LERP_FACTOR * delta;
    this.smoothedCameraPosition.lerp(this.desiredCameraPosition, lerpFactor);

    this.desiredTargetPosition.copy(this.visualRoot.position);
    this.desiredTargetPosition.y += 1;
    this.smoothedCameraTarget.lerp(this.desiredTargetPosition, lerpFactor);

    sceneManager.playerCamera.position.copy(this.smoothedCameraPosition);
    sceneManager.playerCamera.lookAt(this.smoothedCameraTarget);
  }

  private resetPlayerPosition(state: State) {
    const { player } = state;
    if (player.position.y > config.RESET_Y_IN_METERS) return;
    this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, false);
    this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, false);
    this.rigidBody.setTranslation(config.PLAYER_INITIAL_POSITION, true);
    this.prevPosition.copy(config.PLAYER_INITIAL_POSITION);
    this.targetPosition.copy(config.PLAYER_INITIAL_POSITION);
    this.prevQuaternion.identity();
    this.targetQuaternion.identity();
    this.visualRoot.position.copy(config.PLAYER_INITIAL_POSITION);
    this.visualRoot.scale.set(1, 1, 1);
    this.visualRoot.quaternion.identity();
    this.mesh.quaternion.identity();
    this.previousVelocity.set(0, 0, 0);
    this.squashScale.set(1, 1, 1);
    this.targetSquashScale.set(1, 1, 1);
    this.squashQuaternion.identity();
    this.targetSquashQuaternion.identity();
    this.jumpStretchImpulse = 0;
    this.landingSquashImpulse = 0;
    this.impactSquashImpulse = 0;
  }

  private debugPlayer() {
    const folder = debugManager.panel.addFolder({
      title: "⚽️ Player",
      expanded: false,
    });

    const physics = folder.addFolder({ title: "Physics" });
    physics.addBinding(
      config,
      "LIN_VEL_STRENGTH_IN_METERS_PER_SECOND_SQUARED",
      {
        label: "Linear velocity",
        min: 5,
        max: 100,
      },
    );
    physics.addBinding(
      config,
      "ANG_VEL_STRENGTH_IN_RADIANS_PER_SECOND_SQUARED",
      {
        label: "Angular velocity",
        min: 5,
        max: 100,
      },
    );
    physics.addBinding(config, "FALL_MULTIPLIER", {
      label: "Fall multiplier",
      min: 0,
      max: 10,
    });

    const jump = folder.addFolder({ title: "Jump" });
    jump.addBinding(config, "JUMP_VELOCITY_IN_METERS_PER_SECOND", {
      label: "Jump velocity",
      min: 1,
      max: 14,
    });
    jump.addBinding(config, "DOUBLE_JUMP_VELOCITY_IN_METERS_PER_SECOND", {
      label: "Double jump",
      min: 1,
      max: 14,
    });
    jump.addBinding(config, "JUMP_CUT_MULTIPLIER", {
      label: "Jump cut",
      min: 0.1,
      max: 1,
    });
    jump.addBinding(config, "COYOTE_TIME_IN_SECONDS", {
      label: "Coyote time",
      min: 0,
      max: 0.3,
    });

    const water = folder.addFolder({ title: "Water" });
    water.addBinding(config, "BUOYANCY_FORCE_IN_NEWTONS", {
      label: "Buoyancy",
      min: 1,
      max: 20,
    });
    water.addBinding(config, "WATER_VERTICAL_DAMPING_IN_INVERSE_SECONDS", {
      label: "Vertical damp",
      min: 0,
      max: 10,
    });
    water.addBinding(config, "WATER_BOB_FORCE_IN_NEWTONS", {
      label: "Bob strength",
      min: 0,
      max: 10,
    });

    const camera = folder.addFolder({ title: "Camera" });
    camera.addBinding(config.CAMERA_OFFSET, "y", {
      label: "Camera height",
    });
    camera.addBinding(config.CAMERA_OFFSET, "z", {
      label: "Camera distance",
    });

    const visuals = folder.addFolder({ title: "Visuals" });
    visuals.addBinding(config, "ACCELERATION_SQUASH_STRENGTH", {
      label: "Acceleration",
      min: 0,
      max: 0.08,
      step: 0.001,
    });
    visuals.addBinding(config, "JUMP_STRETCH_STRENGTH", {
      label: "Jump stretch",
      min: 0,
      max: 0.6,
      step: 0.01,
    });
    visuals.addBinding(config, "LANDING_SQUASH_STRENGTH", {
      label: "Landing",
      min: 0,
      max: 0.35,
      step: 0.01,
    });
    visuals.addBinding(config, "IMPACT_SQUASH_STRENGTH", {
      label: "Impact",
      min: 0,
      max: 0.2,
      step: 0.005,
    });
    visuals.addBinding(config, "SQUASH_RECOVERY_SPEED_IN_INVERSE_SECONDS", {
      label: "Recovery",
      min: 1,
      max: 40,
      step: 0.5,
    });
    visuals.addBinding(config, "MAX_SQUASH_DEFORMATION", {
      label: "Max deform",
      min: 0,
      max: 0.4,
      step: 0.01,
    });
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

class PlayerMaterial extends MeshLambertNodeMaterial {
  constructor() {
    super();
    this.createMaterial();
  }

  private createMaterial() {
    this.precision = "lowp";
    this.flatShading = false;

    this.castShadowNode = vec3(0.6);

    const baseColor = texture(assetManager.resources.playerDiffuse, uv()).mul(
      2,
    );
    const bakedShadowFactor = TSLUtils.getBakedShadowFactor(positionWorld.xz);
    const withShadow = mix(baseColor.mul(0.15), baseColor, bakedShadowFactor);
    this.colorNode = withShadow;

    const normal = texture(assetManager.resources.playerNormal, uv());
    this.normalNode = normalMap(normal, float(3.5));
  }
}
