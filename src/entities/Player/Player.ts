import { Mesh, Object3D, Vector3, Quaternion } from "three";
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
import { RevoColliderType } from "../../types";
import {
  assetManager,
  debugManager,
  eventsManager,
  inputManager,
  lightingManager,
  physicsManager,
  physicsScheduler,
  sceneManager,
} from "../../systems";
import { TSLUtils } from "../../utils/TSLUtils";
import { realmConfig } from "../../realm/config";
import { playerConfig as config } from "./config";
import { PlayerCamera } from "./PlayerCamera";
import { PlayerSquash } from "./PlayerSquash";

type WaterMask = {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
};

export default class Player {
  private mesh: Mesh;
  private visualRoot: Object3D;
  private rigidBody: RigidBody;
  private collider: Collider;

  private camera = new PlayerCamera();
  private squash = new PlayerSquash();

  private yawInRadians = 0;
  private yawQuaternion = new Quaternion();
  private newLinVel = new Vector3();
  private newAngVel = new Vector3();
  private forwardVec = new Vector3();
  private jumpImpulse = new Vector3();
  private currentVelocity = new Vector3();
  private bodyPosition = new Vector3();
  private rayOrigin = new Vector3();
  private ray = new Ray(this.rayOrigin, config.DOWN);
  private prevPosition = new Vector3();
  private prevQuaternion = new Quaternion();
  private targetPosition = new Vector3();
  private targetQuaternion = new Quaternion();
  private bodyQuaternion = new Quaternion();

  private isOnGround = false;
  private jumpsRemaining = 0;
  private wasJumpHeld = false;
  private jumpBufferTimer = 0;
  private groundingLockTimer = 0;

  private isInWater = false;
  private waterMask: WaterMask | null = null;
  private waterTime = 0;
  private waterImpulse = new Vector3();
  private wasOnGroundBeforePhysics = false;

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

    this.prevPosition.copy(this.rigidBody.translation());
    this.prevQuaternion.copy(this.rigidBody.rotation());
    this.targetPosition.copy(this.prevPosition);
    this.targetQuaternion.copy(this.prevQuaternion);

    eventsManager.on(
      "engine-before-physics",
      this.updateBeforePhysics.bind(this),
    );
    eventsManager.on(
      "engine-after-physics",
      this.updateAfterPhysics.bind(this),
    );
    eventsManager.on("engine-render-update", this.updateRender.bind(this));
    eventsManager.on(
      "engine-render-update-throttle-64x",
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
    // Average combine keeps bounces controlled: wood/rock pairs land in the
    // 0.3-0.45 range instead of inheriting the highest coefficient
    return ColliderDesc.ball(config.RADIUS_IN_METERS)
      .setRestitution(config.RESTITUTION)
      .setRestitutionCombineRule(CoefficientCombineRule.Average)
      .setFriction(config.FRICTION)
      .setMass(config.MASS_IN_KILOGRAMS)
      .setActiveEvents(ActiveEvents.COLLISION_EVENTS);
  }

  private updateBeforePhysics(state: State) {
    const { delta } = state;

    this.bodyPosition.copy(this.rigidBody.translation());
    this.updateWaterState(delta);
    this.updateYaw(delta);

    this.wasOnGroundBeforePhysics = this.isOnGround;
    this.updateVerticalMovement(delta);
    this.updateHorizontalMovement(delta);
  }

  private updateAfterPhysics(state: State) {
    const { delta } = state;

    this.isOnGround = this.groundingLockTimer === 0 && this.checkIfGrounded();

    this.currentVelocity.copy(this.rigidBody.linvel());
    this.squash.update(
      delta,
      this.currentVelocity,
      this.isOnGround,
      this.wasOnGroundBeforePhysics,
      this.isInWater,
      this.forwardVec,
    );
    this.capturePhysicsTarget();
  }

  private updateRender(state: State) {
    const { delta } = state;

    this.visualRoot.position.lerpVectors(
      this.prevPosition,
      this.targetPosition,
      physicsScheduler.alpha,
    );
    this.bodyQuaternion.slerpQuaternions(
      this.prevQuaternion,
      this.targetQuaternion,
      physicsScheduler.alpha,
    );
    this.squash.apply(delta, this.visualRoot, this.mesh, this.bodyQuaternion);
    this.camera.update(delta, this.visualRoot.position, this.yawInRadians);
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
    const bottomY = this.bodyPosition.y - config.RADIUS_IN_METERS;
    const isAboveWaterSurface = bottomY > config.WATER_SURFACE_Y_IN_METERS;
    if (isAboveWaterSurface) return false;

    const waterMapU =
      (this.bodyPosition.x + realmConfig.HALF_MAP_SIZE) / realmConfig.MAP_SIZE;
    const waterMapV =
      (this.bodyPosition.z + realmConfig.HALF_MAP_SIZE) / realmConfig.MAP_SIZE;
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

    const velocity = this.rigidBody.linvel();
    const bottomY = this.bodyPosition.y - config.RADIUS_IN_METERS;
    const submergedDepth = config.WATER_SURFACE_Y_IN_METERS - bottomY;

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

    if (!this.isInWater) {
      const velocity = this.rigidBody.linvel();
      const initialVelocityY = velocity.y;

      this.handleJumpCut(isJumpKeyPressed, velocity);
      if (!this.isOnGround) {
        this.handleFastFall(delta, velocity, physicsManager.world.gravity.y);
      }

      const verticalSpeed = Math.abs(velocity.y);
      const isSlowBounce =
        verticalSpeed <
        config.BOUNCE_SETTLE_VERTICAL_SPEED_IN_METERS_PER_SECOND;
      const shouldSettleBounce =
        this.isOnGround && !isJumpKeyPressed && isSlowBounce;

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
    // deep water has no jumps, but a grounded ball in the shallows should
    // still respond
    if (this.isInWater && !this.isOnGround) return false;
    return this.jumpsRemaining > 0;
  }

  private performJump() {
    const velocity = this.rigidBody.linvel();
    const isGroundJump = this.jumpsRemaining === config.MAX_JUMPS;
    const jumpVelocity = isGroundJump
      ? config.JUMP_VELOCITY_IN_METERS_PER_SECOND
      : config.DOUBLE_JUMP_VELOCITY_IN_METERS_PER_SECOND;
    const velocityChange = Math.max(0, jumpVelocity - velocity.y);
    this.jumpImpulse.set(0, velocityChange * config.MASS_IN_KILOGRAMS, 0);
    this.rigidBody.applyImpulse(this.jumpImpulse, true);
    this.squash.noteJump();
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

    this.yawQuaternion.setFromAxisAngle(config.UP, this.yawInRadians);
    this.forwardVec.copy(config.FORWARD).applyQuaternion(this.yawQuaternion);
  }

  private updateHorizontalMovement(delta: number) {
    const isForward = inputManager.isForward();
    const isBackward = inputManager.isBackward();
    const hasDriveInput = isForward || isBackward;
    if (!hasDriveInput) return;

    const movementMultiplier = this.isInWater
      ? config.WATER_MOVEMENT_MULTIPLIER
      : this.isOnGround
        ? 1
        : config.AIR_CONTROL_FACTOR;
    const linVelScale =
      config.LIN_VEL_STRENGTH_IN_METERS_PER_SECOND_SQUARED *
      delta *
      movementMultiplier;

    this.newLinVel.copy(this.rigidBody.linvel());
    if (isForward) this.newLinVel.addScaledVector(this.forwardVec, linVelScale);
    if (isBackward)
      this.newLinVel.addScaledVector(this.forwardVec, -linVelScale);

    const maxSpeed = config.MAX_SPEED_IN_METERS_PER_SECOND;
    const horizontalSpeed = Math.hypot(this.newLinVel.x, this.newLinVel.z);
    if (horizontalSpeed > maxSpeed) {
      const scale = maxSpeed / horizontalSpeed;
      this.newLinVel.x *= scale;
      this.newLinVel.z *= scale;
    }
    this.rigidBody.setLinvel(this.newLinVel, true);

    // spin follows actual motion (omega = up x v / r) instead of being its
    // own motor, so excess spin can never grip the ball up trees or walls;
    // airborne spin stays natural. While braking, spin follows the input
    // direction instead — backward spin while still sliding forward (drift);
    // magnitude stays tied to the current speed, so no wall traction
    if (this.isOnGround || this.isInWater) {
      const driveSign = isForward === isBackward ? 0 : isForward ? 1 : -1;
      const alongForward =
        this.newLinVel.x * this.forwardVec.x +
        this.newLinVel.z * this.forwardVec.z;
      const isDrifting = driveSign !== 0 && alongForward * driveSign < 0;

      if (isDrifting) {
        const driftSpin =
          (driveSign * Math.abs(alongForward) * config.DRIFT_SPIN_MULTIPLIER) /
          config.RADIUS_IN_METERS;
        this.newAngVel
          .crossVectors(config.UP, this.forwardVec)
          .multiplyScalar(driftSpin);
      } else {
        this.newAngVel
          .crossVectors(config.UP, this.newLinVel)
          .divideScalar(config.RADIUS_IN_METERS);
      }
      this.rigidBody.setAngvel(this.newAngVel, true);
    }
  }

  private capturePhysicsTarget() {
    this.prevPosition.copy(this.targetPosition);
    this.prevQuaternion.copy(this.targetQuaternion);
    this.targetPosition.copy(this.rigidBody.translation());
    this.targetQuaternion.copy(this.rigidBody.rotation());
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
    this.currentVelocity.set(0, 0, 0);
    this.squash.reset();
    this.camera.snapYaw(this.yawInRadians);
    this.jumpsRemaining = 0;
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
        label: "Acceleration",
        min: 5,
        max: 150,
      },
    );
    physics.addBinding(config, "MAX_SPEED_IN_METERS_PER_SECOND", {
      label: "Max speed",
      min: 5,
      max: 40,
    });
    physics.addBinding(config, "AIR_CONTROL_FACTOR", {
      label: "Air control",
      min: 0,
      max: 1,
    });
    physics
      .addBinding(config, "RESTITUTION", {
        label: "Bounciness",
        min: 0,
        max: 1,
      })
      .on("change", ({ value }) => this.collider.setRestitution(value));
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
    camera.addBinding(
      config,
      "CAMERA_POSITION_FOLLOW_SPEED_IN_INVERSE_SECONDS",
      {
        label: "Position follow",
        min: 1,
        max: 40,
        step: 0.5,
      },
    );
    camera.addBinding(config, "CAMERA_TARGET_FOLLOW_SPEED_IN_INVERSE_SECONDS", {
      label: "Target follow",
      min: 1,
      max: 50,
      step: 0.5,
    });
    camera.addBinding(
      config,
      "CAMERA_ROTATION_FOLLOW_SPEED_IN_INVERSE_SECONDS",
      {
        label: "Rotation follow",
        min: 1,
        max: 50,
        step: 0.5,
      },
    );

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
