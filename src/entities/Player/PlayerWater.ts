import { Vector3 } from "three";
import type { RigidBody } from "@dimforge/rapier3d";
import { assetManager } from "../../systems";
import { realmConfig } from "../../realm/config";
import { playerConfig as config } from "./config";

type WaterMask = {
  bits: Uint8Array;
  resolution: number;
};

export class PlayerWater {
  isInWater = false;

  private rigidBody: RigidBody;
  private mask: WaterMask | null;
  private impulse = new Vector3();
  private bobTime = 0;

  constructor(rigidBody: RigidBody) {
    this.rigidBody = rigidBody;
    this.mask = this.createMask();
  }

  update(delta: number, position: Vector3) {
    const bottomY = position.y - config.RADIUS_IN_METERS;
    const wasInWater = this.isInWater;
    this.isInWater = this.checkIfInWater(position, bottomY);

    if (this.isInWater !== wasInWater) this.applyDamping();
    if (this.isInWater) this.applyBuoyancy(delta, bottomY);
  }

  private checkIfInWater(position: Vector3, bottomY: number) {
    if (!this.mask) return false;
    if (bottomY > config.WATER_SURFACE_Y_IN_METERS) return false;

    const { HALF_MAP_SIZE, MAP_SIZE } = realmConfig;
    const mapU = (position.x + HALF_MAP_SIZE) / MAP_SIZE;
    const mapV = (position.z + HALF_MAP_SIZE) / MAP_SIZE;
    if (mapU < 0 || mapU >= 1 || mapV < 0 || mapV >= 1) return false;

    const { bits, resolution } = this.mask;
    const texelX = Math.floor(mapU * resolution);
    const texelY = Math.floor(mapV * resolution);
    const index = texelY * resolution + texelX;
    return (bits[index >> 3] & (1 << (index & 7))) !== 0;
  }

  private applyDamping() {
    const {
      LINEAR_DAMPING_IN_INVERSE_SECONDS: landLinear,
      ANGULAR_DAMPING_IN_INVERSE_SECONDS: landAngular,
      WATER_DAMPING_LINEAR_IN_INVERSE_SECONDS: waterLinear,
      WATER_DAMPING_ANGULAR_IN_INVERSE_SECONDS: waterAngular,
    } = config;

    if (this.isInWater) {
      this.rigidBody.setLinearDamping(waterLinear);
      this.rigidBody.setAngularDamping(waterAngular);
      return;
    }

    this.rigidBody.setLinearDamping(landLinear);
    this.rigidBody.setAngularDamping(landAngular);
  }

  private applyBuoyancy(delta: number, bottomY: number) {
    const submergedDepth = config.WATER_SURFACE_Y_IN_METERS - bottomY;
    if (submergedDepth <= 0) {
      this.bobTime = 0;
      return;
    }

    this.bobTime += delta;

    const {
      BUOYANCY_FORCE_IN_NEWTONS: buoyancyForce,
      WATER_VERTICAL_DAMPING_IN_INVERSE_SECONDS: verticalDampingRate,
      WATER_BOB_FORCE_IN_NEWTONS: bobForce,
      WATER_BOB_FREQUENCY_IN_RADIANS_PER_SECOND: bobFrequency,
      WATER_FULL_SUBMERSION_DEPTH_IN_METERS: fullSubmersionDepth,
      WATER_EDGE_FADE_DEPTH_IN_METERS: edgeFadeDepth,
    } = config;

    const submersionRatio = Math.min(submergedDepth / fullSubmersionDepth, 1);
    const edgeFade = Math.min(submergedDepth / edgeFadeDepth, 1);

    const buoyancy = submersionRatio * buoyancyForce * edgeFade;
    const verticalSpeed = this.rigidBody.linvel().y;
    const verticalDamping = verticalSpeed * -verticalDampingRate * edgeFade;
    const bob = Math.sin(this.bobTime * bobFrequency) * bobForce * edgeFade;

    this.impulse.set(0, (buoyancy + verticalDamping + bob) * delta, 0);
    this.rigidBody.applyImpulse(this.impulse, true);
  }

  private createMask(): WaterMask | null {
    const bits = assetManager.resources.waterMask;
    if (!bits) return null;

    const resolution = Math.sqrt(bits.length * 8);
    if (!Number.isInteger(resolution)) {
      throw new Error(`Water mask is not square: ${bits.length} bytes`);
    }

    return { bits, resolution };
  }
}
