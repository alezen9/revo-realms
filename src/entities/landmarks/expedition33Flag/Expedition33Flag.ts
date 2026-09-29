import {
  Box3,
  CylinderGeometry,
  Mesh,
  PlaneGeometry,
  Quaternion,
  Sphere,
  Vector3,
} from "three";
import { positionLocal, vec3 } from "three/tsl";
import { ColliderDesc } from "@dimforge/rapier3d";
import { type State } from "../../../Game";
import {
  eventBus,
  landmarks,
  physicsWorld,
  graphics,
  stage,
} from "../../../systems";
import type { ComputeTask } from "../../../systems/rendering/ComputeTask";
import { RevoColliderType } from "../../../systems/physics/colliderTypes";
import { VSMReceiverStandardMaterial } from "../../../systems/vsm/VSMReceiverMaterials";
import { UP } from "../../axes";
import { config, uniforms } from "./config";
import { FlagCompute, getParticleAtPlanePosition } from "./FlagCompute";
import { FlagMaterial } from "./FlagMaterial";
import { debugExpedition33Flag } from "./debug";

// top of the hill, sampled once from the terrain heightmap
const HILLTOP = new Vector3(-115.74, 3.5, 215.79);

export class Expedition33Flag {
  private compute = new FlagCompute();
  private computeTask: ComputeTask;
  private origin = HILLTOP.clone();
  private staffAxis = new Vector3();
  private staffQuaternion = new Quaternion();
  private pendingSeconds = 0;
  private isPlayerNear = false;

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
    // the cloth only exists on the gpu, so its bounds cover everywhere it can reach
    const reach = config.FLAG_WIDTH * config.TETHER_SLACK;
    const bounds = new Box3(
      new Vector3(
        -reach,
        config.ATTACH_TOP - config.FLAG_HEIGHT - reach,
        -reach,
      ),
      new Vector3(reach, config.ATTACH_TOP, reach),
    );
    geometry.boundingBox = bounds;
    geometry.boundingSphere = bounds.getBoundingSphere(new Sphere());
    const flag = new Mesh(geometry, new FlagMaterial(this.compute));
    flag.position.copy(this.origin);

    const particlePosition = getParticleAtPlanePosition(
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
  };
}
