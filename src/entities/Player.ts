import { Mesh, Vector3, Quaternion } from "three";
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
import { physicsManager, sceneManager, eventsManager } from "../systems";
import { TSLUtils } from "../utils/TSLUtils";
import {
  assetManager,
  lightingManager,
  debugManager,
  inputManager,
} from "../systems";

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
    JUMP_VELOCITY_IN_METERS_PER_SECOND: 9.8,
    DOUBLE_JUMP_VELOCITY_IN_METERS_PER_SECOND: 8.6,
    JUMP_CUT_MULTIPLIER: 0.62,
    JUMP_GROUNDING_LOCK_TIME_IN_SECONDS: 0.08,
    FALL_MULTIPLIER: 2.05,
    LINEAR_DAMPING_IN_INVERSE_SECONDS: 1.15,
    ANGULAR_DAMPING_IN_INVERSE_SECONDS: 0.65,
    // Water physics
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
    LIN_VEL_STRENGTH_IN_METERS_PER_SECOND_SQUARED: 55,
    ANG_VEL_STRENGTH_IN_RADIANS_PER_SECOND_SQUARED: 55,
    RADIUS_IN_METERS: 0.5,
    MASS_IN_KILOGRAMS: 0.5,
    FRICTION: 1,
    RESTITUTION: 0.52,
    TURN_SPEED_IN_RADIANS_PER_SECOND: 2,
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
  private jumpImpulse = new Vector3();

  // Player State
  private isOnGround = false;
  private jumpCount = 0;
  private wasJumpHeld = false;
  private jumpBufferTimer = 0;
  private coyoteTimer = 0;
  private groundingLockTimer = 0;

  // Water state
  private isInWater = false;
  private waterData: Uint8ClampedArray | null = null;
  private waterMapWidth = 0;
  private waterMapHeight = 0;
  private waterTime = 0;

  private rayOrigin = new Vector3();
  private ray = new Ray(this.rayOrigin, config.DOWN);

  private prevPosition = new Vector3();
  private prevQuaternion = new Quaternion();
  private targetPosition = new Vector3();
  private targetQuaternion = new Quaternion();

  constructor() {
    this.mesh = this.createCharacterMesh();
    sceneManager.scene.add(this.mesh);

    lightingManager.setTarget(this.mesh);

    this.rigidBody = physicsManager.world.createRigidBody(
      this.createRigidBodyDesc(),
    );
    const collider = physicsManager.world.createCollider(
      this.createColliderDesc(),
      this.rigidBody,
    );
    collider.userData = { type: RevoColliderType.Player };

    // Initialize interpolation state
    this.prevPosition.copy(this.rigidBody.translation());
    this.prevQuaternion.copy(this.rigidBody.rotation());
    this.targetPosition.copy(this.prevPosition);
    this.targetQuaternion.copy(this.prevQuaternion);

    eventsManager.on("engine-update", this.update.bind(this));
    eventsManager.on(
      "engine-update-throttle-64x",
      this.resetPlayerPosition.bind(this),
    );
    this.initWaterDetection();
    this.debugPlayer();
  }

  private resetPlayerPosition(state: State) {
    const { player } = state;
    if (player.position.y > config.RESET_Y_IN_METERS) return;
    this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, false);
    this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, false);
    this.rigidBody.setTranslation(config.PLAYER_INITIAL_POSITION, true);
    this.mesh.position.copy(config.PLAYER_INITIAL_POSITION);
  }

  private debugPlayer() {
    const folder = debugManager.panel.addFolder({
      title: "⚽️ Player",
      expanded: false,
    });
    const physics = folder.addFolder({ title: "Physics" });
    physics.addBinding(config, "LIN_VEL_STRENGTH_IN_METERS_PER_SECOND_SQUARED", {
      label: "Linear velocity",
      min: 5,
      max: 100,
    });
    physics.addBinding(config, "ANG_VEL_STRENGTH_IN_RADIANS_PER_SECOND_SQUARED", {
      label: "Angular velocity",
      min: 5,
      max: 100,
    });
    physics.addBinding(config, "JUMP_VELOCITY_IN_METERS_PER_SECOND", {
      label: "Jump velocity",
      min: 1,
      max: 14,
    });
    physics.addBinding(config, "DOUBLE_JUMP_VELOCITY_IN_METERS_PER_SECOND", {
      label: "Double jump",
      min: 1,
      max: 14,
    });
    physics.addBinding(config, "JUMP_CUT_MULTIPLIER", {
      label: "Jump cut",
      min: 0.1,
      max: 1,
    });
    physics.addBinding(config, "COYOTE_TIME_IN_SECONDS", {
      label: "Coyote time",
      min: 0,
      max: 0.3,
    });
    physics.addBinding(config, "ANGULAR_DAMPING_IN_INVERSE_SECONDS", {
      label: "Angular damping",
      min: 0,
      max: 5,
    });
    physics.addBinding(config, "FALL_MULTIPLIER", {
      label: "Fall multiplier",
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
  }

  private initWaterDetection() {
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
      this.waterData = imageData.data;
      this.waterMapWidth = canvas.width;
      this.waterMapHeight = canvas.height;
    } catch {
      // Water detection unavailable
    }
  }

  private checkIfInWater(): boolean {
    if (!this.waterData) return false;
    const pos = this.rigidBody.translation();
    if (pos.y - config.RADIUS_IN_METERS > config.WATER_SURFACE_Y_IN_METERS)
      return false;

    const u = (pos.x + 256) / 512;
    const v = (pos.z + 256) / 512;
    const px = Math.floor(u * this.waterMapWidth);
    const py = Math.floor(v * this.waterMapHeight);
    const idx = (py * this.waterMapWidth + px) * 4;
    return this.waterData[idx] > 128;
  }

  private applyWaterPhysics(delta: number) {
    this.waterTime += delta;

    const pos = this.rigidBody.translation();
    const vel = this.rigidBody.linvel();
    const submergedDepth =
      config.WATER_SURFACE_Y_IN_METERS - (pos.y - config.RADIUS_IN_METERS);

    if (submergedDepth <= 0) {
      this.waterTime = 0;
      return;
    }

    const submersionRatio = Math.min(submergedDepth, 1);
    const edgeFade = Math.min(submergedDepth * 2, 1);

    const buoyancy =
      submersionRatio * config.BUOYANCY_FORCE_IN_NEWTONS * edgeFade;
    const verticalDamping =
      vel.y * -config.WATER_VERTICAL_DAMPING_IN_INVERSE_SECONDS * edgeFade;

    // Simple harmonic bob (1 sin instead of 4)
    const bob =
      Math.sin(this.waterTime * 4) *
      config.WATER_BOB_FORCE_IN_NEWTONS *
      edgeFade;

    this.rigidBody.applyImpulse(
      { x: 0, y: (buoyancy + verticalDamping + bob) * delta, z: 0 },
      true,
    );
  }

  private createCharacterMesh() {
    const mesh = assetManager.resources.worldModel.scene.getObjectByName(
      "player",
    ) as Mesh;
    mesh.material = new PlayerMaterial();
    mesh.castShadow = true;
    mesh.position.copy(config.PLAYER_INITIAL_POSITION);
    return mesh;
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

    // Water state detection
    const wasInWater = this.isInWater;
    this.isInWater = this.checkIfInWater();

    // Switch damping on water entry/exit
    if (this.isInWater !== wasInWater) {
      this.rigidBody.setLinearDamping(
        this.isInWater
          ? config.WATER_DAMPING_LINEAR_IN_INVERSE_SECONDS
          : config.LINEAR_DAMPING_IN_INVERSE_SECONDS,
      );
      this.rigidBody.setAngularDamping(
        this.isInWater
          ? config.WATER_DAMPING_ANGULAR_IN_INVERSE_SECONDS
          : config.ANGULAR_DAMPING_IN_INVERSE_SECONDS,
      );
    }

    if (this.isInWater) this.applyWaterPhysics(delta);

    if (this.prevYawInRadians !== this.yawInRadians) {
      this.yawQuaternion.setFromAxisAngle(config.UP, this.yawInRadians);
      this.prevYawInRadians = this.yawInRadians;
    }

    this.updateVerticalMovement(delta);
    this.updateHorizontalMovement(delta);
    this.syncMeshWithBody();
    this.updateCameraPosition(delta);
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

      if (
        this.isOnGround &&
        !isJumpKeyPressed &&
        Math.abs(velocity.y) <
          config.BOUNCE_SETTLE_VERTICAL_SPEED_IN_METERS_PER_SECOND
      ) {
        velocity.y = 0;
      }

      const didVerticalVelocityChange = velocity.y !== initialVelocityY;
      if (didVerticalVelocityChange) {
        this.rigidBody.setLinvel(velocity, true);
      }
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

  private updateHorizontalMovement(delta: number) {
    const isForward = inputManager.isForward();
    const isBackward = inputManager.isBackward();
    const isLeftward = inputManager.isLeftward();
    const isRightward = inputManager.isRightward();

    if (isLeftward)
      this.yawInRadians += config.TURN_SPEED_IN_RADIANS_PER_SECOND * delta;
    if (isRightward)
      this.yawInRadians -= config.TURN_SPEED_IN_RADIANS_PER_SECOND * delta;

    this.forwardVec.copy(config.FORWARD).applyQuaternion(this.yawQuaternion);

    this.torqueAxis.crossVectors(config.UP, this.forwardVec).normalize();

    this.newLinVel.copy(this.rigidBody.linvel());
    this.newAngVel.copy(this.rigidBody.angvel());

    const waterMult = this.isInWater ? config.WATER_MOVEMENT_MULTIPLIER : 1;
    const linVelScale =
      config.LIN_VEL_STRENGTH_IN_METERS_PER_SECOND_SQUARED *
      delta *
      waterMult;
    const angVelScale =
      config.ANG_VEL_STRENGTH_IN_RADIANS_PER_SECOND_SQUARED *
      delta *
      waterMult;

    if (isForward) {
      this.newLinVel.addScaledVector(this.forwardVec, linVelScale);
      this.newAngVel.addScaledVector(this.torqueAxis, angVelScale);
    }
    if (isBackward) {
      this.newLinVel.addScaledVector(this.forwardVec, -linVelScale);
      this.newAngVel.addScaledVector(this.torqueAxis, -angVelScale);
    }

    const hasDriveInput = isForward || isBackward;
    if (hasDriveInput) {
      this.rigidBody.setLinvel(this.newLinVel, true);
      this.rigidBody.setAngvel(this.newAngVel, true);
    }
  }

  private syncMeshWithBody() {
    // only update prev/target when physics actually stepped
    if (physicsManager.didStep) {
      this.prevPosition.copy(this.targetPosition);
      this.prevQuaternion.copy(this.targetQuaternion);
      this.targetPosition.copy(this.rigidBody.translation());
      this.targetQuaternion.copy(this.rigidBody.rotation());
    }

    // interpolate for smooth rendering between physics steps
    const alpha = physicsManager.alpha;
    this.mesh.position.lerpVectors(
      this.prevPosition,
      this.targetPosition,
      alpha,
    );
    this.mesh.quaternion.slerpQuaternions(
      this.prevQuaternion,
      this.targetQuaternion,
      alpha,
    );
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
    sceneManager.playerCamera.position.copy(this.smoothedCameraPosition);
    sceneManager.playerCamera.lookAt(this.smoothedCameraTarget);
  }

  get position() {
    return this.mesh.position;
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
