import { Mesh, Vector3, Quaternion } from "three";
import {
  ColliderDesc,
  RigidBody,
  RigidBodyDesc,
  Ray,
  type Vector,
  ActiveEvents,
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
  const jumpImpulse = 100;
  return {
    JUMP_BUFFER_DURATION_IN_SECONDS: 0.2,
    MAX_CONSECUTIVE_JUMPS: 2,
    JUMP_CUT_MULTIPLIER: 0.15,
    FALL_MULTIPLIER: 2.75,
    MAX_UPWARD_VELOCITY: 6,
    LINEAR_DAMPING: 1.4,
    ANGULAR_DAMPING: 1.2,
    // Water physics
    WATER_SURFACE_Y: -0.5,
    WATER_DAMPING_LINEAR: 5.0,
    WATER_DAMPING_ANGULAR: 3.5,
    WATER_MOVEMENT_MULTIPLIER: 0.5,
    BUOYANCY_FORCE: 7.25,
    WATER_VERTICAL_DAMPING: 0.5,
    WATER_BOB_SUBMERGED_STRENGTH: 2.5,
    GROUND_RAY_START_ABOVE_BOTTOM: 0.03,
    GROUND_RAY_MAX_DISTANCE: 0.1,
    GROUND_CONTACT_THRESHOLD: 0.04,
    BOUNCE_SETTLE_VERTICAL_SPEED: 0.45,
    JUMP_IMPULSE: new Vector3(0, jumpImpulse, 0),
    LIN_VEL_STRENGTH: 70,
    ANG_VEL_STRENGTH: 50,
    RADIUS: 0.5,
    MASS: 0.5,
    FRICTION: 1,
    RESTITUTION: 0.6,
    TURN_SPEED: 2, // radians/sec
    PLAYER_INITIAL_POSITION: new Vector3(...POSITIONS.lake),
    CAMERA_OFFSET: new Vector3(0, 16, 20),
    CAMERA_LERP_FACTOR: 7.5,
    UP: new Vector3(0, 1, 0),
    DOWN: new Vector3(0, -1, 0),
    FORWARD: new Vector3(0, 0, -1),
    RESET_Y: -15,
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
    physicsManager.world.createCollider(
      this.createColliderDesc(),
      this.rigidBody,
    );

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
    if (player.position.y > config.RESET_Y) return;
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
    physics.addBinding(config, "LIN_VEL_STRENGTH", {
      label: "Linear velocity",
      min: 5,
      max: 100,
    });
    physics.addBinding(config, "ANG_VEL_STRENGTH", {
      label: "Angular velocity",
      min: 5,
      max: 100,
    });
    physics.addBinding(config, "ANGULAR_DAMPING", {
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
    water.addBinding(config, "BUOYANCY_FORCE", {
      label: "Buoyancy",
      min: 1,
      max: 20,
    });
    water.addBinding(config, "WATER_VERTICAL_DAMPING", {
      label: "Vertical damp",
      min: 0,
      max: 10,
    });
    water.addBinding(config, "WATER_BOB_SUBMERGED_STRENGTH", {
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
    if (pos.y - config.RADIUS > config.WATER_SURFACE_Y) return false;

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
    const submergedDepth = config.WATER_SURFACE_Y - (pos.y - config.RADIUS);

    if (submergedDepth <= 0) {
      this.waterTime = 0;
      return;
    }

    const submersionRatio = Math.min(submergedDepth, 1);
    const edgeFade = Math.min(submergedDepth * 2, 1);

    const buoyancy = submersionRatio * config.BUOYANCY_FORCE * edgeFade;
    const verticalDamping = vel.y * -config.WATER_VERTICAL_DAMPING * edgeFade;

    // Simple harmonic bob (1 sin instead of 4)
    const bob =
      Math.sin(this.waterTime * 4) *
      config.WATER_BOB_SUBMERGED_STRENGTH *
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
      .setLinearDamping(config.LINEAR_DAMPING)
      .setAngularDamping(config.ANGULAR_DAMPING)
      .setUserData({ type: RevoColliderType.Player });
  }

  private createColliderDesc() {
    return ColliderDesc.ball(config.RADIUS)
      .setRestitution(config.RESTITUTION)
      .setFriction(config.FRICTION)
      .setMass(config.MASS)
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
        this.isInWater ? config.WATER_DAMPING_LINEAR : config.LINEAR_DAMPING,
      );
      this.rigidBody.setAngularDamping(
        this.isInWater ? config.WATER_DAMPING_ANGULAR : config.ANGULAR_DAMPING,
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

    // 4) Mid-air logic (jump cut, fast fall, clamp) - skip in water
    if (!this.isInWater) {
      const velocity = this.rigidBody.linvel();
      const initialVelocityY = velocity.y;

      this.handleJumpCut(isJumpKeyPressed, velocity);
      if (!this.isOnGround) {
        this.handleFastFall(delta, velocity, physicsManager.world.gravity.y);
      }
      this.clampUpwardVelocity(velocity);

      const shouldSettleBounce =
        this.isOnGround &&
        !isJumpKeyPressed &&
        Math.abs(velocity.y) < config.BOUNCE_SETTLE_VERTICAL_SPEED;
      if (shouldSettleBounce) velocity.y = 0;

      const didVerticalVelocityChange = velocity.y !== initialVelocityY;
      if (didVerticalVelocityChange) {
        this.rigidBody.setLinvel(velocity, !shouldSettleBounce);
      }
    }

    // 5) Save jump key state
    this.wasJumpHeld = isJumpKeyPressed;
  }

  private checkIfGrounded(): boolean {
    // Cast from just above the sphere's bottom for stable grounding.
    this.rayOrigin.copy(this.rigidBody.translation());
    this.rayOrigin.y -= config.RADIUS - config.GROUND_RAY_START_ABOVE_BOTTOM;
    const hit = physicsManager.world.castRay(
      this.ray,
      config.GROUND_RAY_MAX_DISTANCE,
      true,
      undefined,
      undefined,
      undefined,
      this.rigidBody,
    );
    if (!hit) return false;
    return hit.timeOfImpact <= config.GROUND_CONTACT_THRESHOLD;
  }

  private canJump(): boolean {
    if (this.isInWater) return false;
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

    if (isLeftward) this.yawInRadians += config.TURN_SPEED * delta;
    if (isRightward) this.yawInRadians -= config.TURN_SPEED * delta;

    this.forwardVec.copy(config.FORWARD).applyQuaternion(this.yawQuaternion);

    this.torqueAxis.crossVectors(config.UP, this.forwardVec).normalize();

    this.newLinVel.copy(this.rigidBody.linvel());
    this.newAngVel.copy(this.rigidBody.angvel());

    const waterMult = this.isInWater ? config.WATER_MOVEMENT_MULTIPLIER : 1;
    const linVelScale = config.LIN_VEL_STRENGTH * delta * waterMult;
    const angVelScale = config.ANG_VEL_STRENGTH * delta * waterMult;

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
    return config.RADIUS;
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
