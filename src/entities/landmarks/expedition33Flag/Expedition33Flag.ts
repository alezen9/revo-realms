import { Box3, Mesh, PlaneGeometry, Quaternion, Sphere, Vector3 } from "three";
import { positionLocal } from "three/tsl";
import { ColliderDesc } from "@dimforge/rapier3d";
import { type State } from "../../../Game";
import {
  assets,
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
import { placeAtAnchor } from "../placeAtAnchor";
import { config, uniforms } from "./config";
import { FlagCompute, getParticleAtPlanePosition } from "./FlagCompute";
import { FlagMaterial } from "./FlagMaterial";
import { FlagPetals } from "./FlagPetals";
import { debugExpedition33Flag } from "./debug";

// bounds in the model's own upright frame, before the anchor leans and places it
const getModelBounds = (mesh: Mesh) => {
  mesh.geometry.computeBoundingBox();
  const { boundingBox } = mesh.geometry;
  if (!boundingBox) throw new Error(`"${mesh.name}" has no bounds`);
  return boundingBox.clone().applyMatrix4(mesh.matrix);
};

export class Expedition33Flag {
  private compute = new FlagCompute();
  private computeTask: ComputeTask;
  private petals: FlagPetals;
  private origin = new Vector3();
  private pendingSeconds = 0;
  private isPlayerNear = false;

  constructor() {
    const { expedition33FlagModel } = assets.resources;
    const staff = assets.getMesh("expedition-33-staff", expedition33FlagModel);
    const flag = assets.getMesh("expedition-33-flag", expedition33FlagModel);
    const staffBounds = getModelBounds(staff);
    const flagBounds = getModelBounds(flag);
    placeAtAnchor("expedition-33-flag", [staff]);
    const anchorScale = staff.scale.x;
    const staffSize = staffBounds
      .getSize(new Vector3())
      .multiplyScalar(anchorScale);
    const flagSize = flagBounds
      .getSize(new Vector3())
      .multiplyScalar(anchorScale);
    uniforms.uFlagWidth.value = flagSize.x;
    uniforms.uFlagHeight.value = flagSize.y;
    uniforms.uAttachTop.value =
      (flagBounds.max.y - staffBounds.min.y) * anchorScale;

    // the staff stands on its origin and leans with the anchor
    this.origin.copy(staff.position);
    const staffAxis = UP.clone().applyQuaternion(staff.quaternion);
    uniforms.uStaffAxis.value.copy(staffAxis);

    this.styleStaff(staff);
    stage.mainScene.add(staff, this.createFlag());
    this.createPhysics(staff.quaternion, staffAxis, staffSize);

    this.computeTask = graphics.createComputeTask({
      label: "Expedition33",
      init: this.compute.computeInit,
      update: this.compute.computeUpdate,
    });
    this.computeTask.init();
    this.petals = new FlagPetals(this.compute, this.origin);

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

  private styleStaff(staff: Mesh) {
    staff.material = new VSMReceiverStandardMaterial({
      color: 0x8a8f98,
      metalness: 0.9,
      roughness: 0.35,
    });
    graphics.vsmPass.registerCaster(staff);
  }

  // the cloth is rebuilt as a regular grid, the simulation pairs vertex and
  // particle by index and an exported mesh does not keep its vertex order
  private createFlag() {
    const geometry = new PlaneGeometry(
      1,
      1,
      config.SEGMENTS_X,
      config.SEGMENTS_Y,
    );
    // the cloth only exists on the gpu, so its bounds cover everywhere it can reach
    const attachTop = uniforms.uAttachTop.value;
    const reach = uniforms.uFlagWidth.value * config.TETHER_SLACK;
    const bounds = new Box3(
      new Vector3(
        -reach,
        attachTop - uniforms.uFlagHeight.value - reach,
        -reach,
      ),
      new Vector3(reach, attachTop, reach),
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
      positionNode: particlePosition,
    });
    return flag;
  }

  private createPhysics(
    staffQuaternion: Quaternion,
    staffAxis: Vector3,
    staffSize: Vector3,
  ) {
    const height = staffSize.y;
    const radius = staffSize.x / 2;
    const translation = this.origin
      .clone()
      .addScaledVector(staffAxis, height / 2);
    const colliderDesc = ColliderDesc.cylinder(height / 2, radius)
      .setTranslation(translation.x, translation.y, translation.z)
      .setRotation(staffQuaternion)
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
    this.petals.update(delta);
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
