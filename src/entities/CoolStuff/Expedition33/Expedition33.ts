import {
  CylinderGeometry,
  Mesh,
  PlaneGeometry,
  Quaternion,
  Sphere,
  Vector3,
} from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { ColliderDesc } from "@dimforge/rapier3d";
import { type State } from "../../../Game";
import {
  debugManager,
  eventsManager,
  landmarkManager,
  physicsManager,
  rendererManager,
  sceneManager,
  windManager,
} from "../../../systems";
import type { ComputeTask } from "../../../systems/RendererManager/ComputeTask";
import { RevoColliderType } from "../../../types";
import { UP } from "../../../utils/axes";
import { config, uniforms } from "./config";
import { FlagMaterial } from "./FlagMaterial";
import { FlagSsbo } from "./FlagSsbo";

// top of the hill, sampled once from the terrain heightmap
const HILLTOP = new Vector3(-115.74, 3.5, 215.79);

export default class Expedition33 {
  private ssbo = new FlagSsbo();
  private computeTask: ComputeTask;
  private origin = HILLTOP.clone();
  private staffAxis = new Vector3();
  private staffQuaternion = new Quaternion();
  private pendingDelta = 0;
  private isPlayerNear = false;

  constructor() {
    const leanDirection = new Vector3(-HILLTOP.x, 0, -HILLTOP.z).normalize();
    this.staffAxis
      .copy(UP)
      .multiplyScalar(Math.cos(config.STAFF_LEAN_RADIANS))
      .addScaledVector(leanDirection, Math.sin(config.STAFF_LEAN_RADIANS));
    this.staffQuaternion.setFromUnitVectors(UP, this.staffAxis);
    uniforms.uStaffAxis.value.copy(this.staffAxis);

    sceneManager.mainScene.add(this.createStaff(), this.createFlag());
    this.createPhysics();

    this.computeTask = rendererManager.createComputeTask({
      label: "Expedition33",
      init: this.ssbo.computeInit,
      update: [
        this.ssbo.computeIntegrate,
        ...this.ssbo.computeConstraintPasses,
      ],
    });
    this.computeTask.init();

    const landmarkId = landmarkManager.register({
      name: "Expedition 33",
      icon: "flag",
      position: this.origin,
      discoveryRadius: 100,
      arrivalRadius: 15,
    });
    const windTargetId = windManager.registerTarget(
      "Expedition 33",
      this.origin,
      15,
    );
    landmarkManager.setWindTargetId(landmarkId, windTargetId);

    eventsManager.on("engine-render-update", this.onEngineUpdate);
    eventsManager.on("engine-render-update-throttle-64x", this.onGateUpdate);
    this.debug();
  }

  private createStaff() {
    const geometry = new CylinderGeometry(
      config.STAFF_RADIUS * 0.75,
      config.STAFF_RADIUS,
      config.STAFF_HEIGHT,
      10,
    );
    const material = new MeshStandardNodeMaterial({
      color: 0x8a8f98,
      metalness: 0.9,
      roughness: 0.35,
    });
    const staff = new Mesh(geometry, material);
    staff.position
      .copy(this.origin)
      .addScaledVector(this.staffAxis, config.STAFF_HEIGHT / 2);
    staff.quaternion.copy(this.staffQuaternion);
    return staff;
  }

  private createFlag() {
    const geometry = new PlaneGeometry(
      1,
      1,
      config.SEGMENTS_X,
      config.SEGMENTS_Y,
    );
    const center = this.staffAxis
      .clone()
      .multiplyScalar(config.ATTACH_TOP - config.FLAG_HEIGHT / 2);
    geometry.boundingSphere = new Sphere(
      center,
      config.FLAG_WIDTH + config.FLAG_HEIGHT,
    );
    const flag = new Mesh(geometry, new FlagMaterial(this.ssbo));
    flag.position.copy(this.origin);
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
    physicsManager.world.createCollider(colliderDesc).userData = {
      type: RevoColliderType.Stone,
    };
  }

  private onGateUpdate = ({ player }: State) => {
    this.isPlayerNear =
      player.position.distanceToSquared(this.origin) <
      config.SIM_DISTANCE_SQUARED;
  };

  private onEngineUpdate = ({ delta, player }: State) => {
    this.pendingDelta = Math.min(this.pendingDelta + delta, 1 / 30);
    if (!this.isPlayerNear) return;
    if (!this.computeTask.canUpdate) return;

    uniforms.uPlayerLocalPosition.value.copy(player.position).sub(this.origin);
    uniforms.uPlayerRadius.value = player.radius;
    uniforms.uDelta.value = this.pendingDelta;
    this.pendingDelta = 0;
    this.computeTask.update();
  };

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🚩 Expedition 33",
      expanded: false,
    });
    folder.addBinding(uniforms.uWindStrength, "value", {
      label: "Wind strength",
      min: 0,
      max: 2,
    });
    folder.addBinding(uniforms.uWindForce, "value", {
      label: "Wind force",
      min: 0,
      max: 100,
    });
    folder.addBinding(uniforms.uGustStrength, "value", {
      label: "Gust strength",
      min: 0,
      max: 1,
    });
    folder.addBinding(uniforms.uGustSpeed, "value", {
      label: "Gust speed",
      min: 0,
      max: 1,
    });
    folder.addBinding(uniforms.uFlutter, "value", {
      label: "Flutter",
      min: 0,
      max: 15,
    });
    folder.addBinding(uniforms.uGravity, "value", {
      label: "Gravity",
      min: 0,
      max: 10,
    });
    folder.addBinding(uniforms.uStiffness, "value", {
      label: "Stiffness",
      min: 0,
      max: 2,
    });
    folder.addBinding(uniforms.uDamping, "value", {
      label: "Damping",
      min: 0,
      max: 8,
    });
    folder.addBinding(uniforms.uThickness, "value", {
      label: "Thickness",
      min: 0,
      max: 0.3,
    });
    folder.addBinding(uniforms.uCollisionPadding, "value", {
      label: "Collision padding",
      min: 0,
      max: 1,
    });
    folder.addBinding(uniforms.uDiffuseScale, "value", {
      label: "Diffuse scale",
      min: 0,
      max: 6,
    });
    folder.addBinding(uniforms.uEmissive, "value", {
      label: "Emissive",
      min: 0,
      max: 40,
    });
  }
}
