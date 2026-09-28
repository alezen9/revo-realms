import {
  Box3,
  CylinderGeometry,
  Mesh,
  PlaneGeometry,
  Quaternion,
  Sphere,
  Vector3,
} from "three";
import { ReadbackBuffer } from "three/webgpu";
import { VSMReceiverStandardMaterial } from "../../../systems/vsm/VSMReceiverMaterials";
import { ColliderDesc } from "@dimforge/rapier3d";
import { type State } from "../../../Game";
import { positionLocal, vec3 } from "three/tsl";
import {
  eventBus,
  landmarks,
  physicsWorld,
  graphics,
  stage,
} from "../../../systems";
import type { ComputeTask } from "../../../systems/rendering/ComputeTask";
import { RevoColliderType } from "../../../systems/physics/colliderTypes";
import { UP } from "../../axes";
import { config, uniforms } from "./config";
import { FlagMaterial } from "./FlagMaterial";
import { FlagCompute, getParticleAtPlanePoint } from "./FlagCompute";
import { debugExpedition33Flag } from "./debug";

// top of the hill, sampled once from the terrain heightmap
const HILLTOP = new Vector3(-115.74, 3.5, 215.79);
const BOUNDS_BYTE_LENGTH = 2 * 4 * Float32Array.BYTES_PER_ELEMENT;

export class Expedition33Flag {
  private compute = new FlagCompute();
  private computeTask: ComputeTask;
  private origin = HILLTOP.clone();
  private staffAxis = new Vector3();
  private staffQuaternion = new Quaternion();
  private pendingSeconds = 0;
  private isPlayerNear = false;
  // the cloth only exists on the gpu, so culling and shadow pages read its bounds back
  private bounds = new Box3();
  private boundingSphere = new Sphere();
  private boundsReadback = new ReadbackBuffer(BOUNDS_BYTE_LENGTH);
  private isReadingBounds = false;

  constructor() {
    const leanDirection = new Vector3(-HILLTOP.x, 0, -HILLTOP.z).normalize();
    this.staffAxis
      .copy(UP)
      .multiplyScalar(Math.cos(config.STAFF_LEAN_RADIANS))
      .addScaledVector(leanDirection, Math.sin(config.STAFF_LEAN_RADIANS));
    this.staffQuaternion.setFromUnitVectors(UP, this.staffAxis);
    uniforms.uStaffAxis.value.copy(this.staffAxis);

    stage.mainScene.add(this.createStaff(), this.createFlag());
    this.createPhysics();

    this.computeTask = graphics.createComputeTask({
      label: "Expedition33",
      init: this.compute.computeInit,
      update: this.compute.computeUpdate,
    });
    this.computeTask.init();

    landmarks.register({
      name: "Expedition 33",
      icon: "flag",
      position: this.origin,
      arrivalRadius: 15,
    });

    eventBus.on("engine-render-update", this.onEngineUpdate);
    eventBus.on("engine-render-update-throttle-64x", this.onGateUpdate);
    debugExpedition33Flag();
  }

  private createStaff() {
    const geometry = new CylinderGeometry(
      config.STAFF_RADIUS * 0.75,
      config.STAFF_RADIUS,
      config.STAFF_HEIGHT,
      10,
    );
    const material = new VSMReceiverStandardMaterial({
      color: 0x8a8f98,
      metalness: 0.9,
      roughness: 0.35,
    });
    const staff = new Mesh(geometry, material);
    staff.position
      .copy(this.origin)
      .addScaledVector(this.staffAxis, config.STAFF_HEIGHT / 2);
    staff.quaternion.copy(this.staffQuaternion);
    graphics.vsmPass.registerCaster(staff);
    return staff;
  }

  private createFlag() {
    const geometry = new PlaneGeometry(
      1,
      1,
      config.SEGMENTS_X,
      config.SEGMENTS_Y,
    );
    const reach = config.FLAG_WIDTH * config.TETHER_SLACK;
    this.bounds.min.set(
      -reach,
      config.ATTACH_TOP - config.FLAG_HEIGHT - reach,
      -reach,
    );
    this.bounds.max.set(reach, config.ATTACH_TOP, reach);
    this.bounds.getBoundingSphere(this.boundingSphere);
    geometry.boundingBox = this.bounds;
    geometry.boundingSphere = this.boundingSphere;
    const flag = new Mesh(geometry, new FlagMaterial(this.compute));
    flag.position.copy(this.origin);

    const particlePosition = getParticleAtPlanePoint(
      this.compute.positions,
      positionLocal,
    );
    graphics.vsmPass.registerCaster(flag, {
      type: "dynamic",
      positionNode: particlePosition.add(vec3(this.origin)),
    });
    return flag;
  }

  private createPhysics() {
    const translation = this.origin
      .clone()
      .addScaledVector(this.staffAxis, config.STAFF_HEIGHT / 2);
    const colliderDesc = ColliderDesc.cylinder(
      config.STAFF_HEIGHT / 2,
      config.STAFF_RADIUS,
    )
      .setTranslation(translation.x, translation.y, translation.z)
      .setRotation(this.staffQuaternion)
      .setRestitution(0.4);
    physicsWorld.world.createCollider(colliderDesc).userData = {
      type: RevoColliderType.Stone,
    };
  }

  private onGateUpdate = ({ player }: State) => {
    this.isPlayerNear =
      player.position.distanceToSquared(this.origin) <
      config.SIM_DISTANCE_SQUARED;
  };

  private onEngineUpdate = ({ delta, player }: State) => {
    if (!this.isPlayerNear) return;
    if (!this.computeTask.canUpdate) return;

    this.pendingSeconds = Math.min(
      this.pendingSeconds + delta,
      config.MAX_CATCH_UP_SECONDS,
    );
    const stepCount = Math.floor(this.pendingSeconds / config.STEP_SECONDS);
    if (stepCount === 0) return;
    this.pendingSeconds -= stepCount * config.STEP_SECONDS;

    uniforms.uStepCount.value = stepCount;
    uniforms.uPlayerLocalPosition.value.copy(player.position).sub(this.origin);
    uniforms.uPlayerRadius.value = player.radius;
    this.computeTask.update();
    if (!this.isReadingBounds) this.readBounds();
  };

  private readBounds = async () => {
    this.isReadingBounds = true;
    const readback = await graphics.renderer.getArrayBufferAsync(
      this.compute.bounds.value,
      this.boundsReadback,
    );
    try {
      const { buffer } = readback;
      if (!buffer) throw new Error("[Expedition33] bounds readback is empty");
      const values = new Float32Array(buffer);
      this.bounds.min.fromArray(values, 0).subScalar(config.BOUNDS_MARGIN);
      this.bounds.max.fromArray(values, 4).addScalar(config.BOUNDS_MARGIN);
      this.bounds.getBoundingSphere(this.boundingSphere);
    } finally {
      readback.release();
      this.isReadingBounds = false;
    }
  };
}
