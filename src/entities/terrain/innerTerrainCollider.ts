import {
  CoefficientCombineRule,
  ColliderDesc,
  HeightFieldFlags,
} from "@dimforge/rapier3d";
import { physicsWorld } from "../../systems";
import { RevoColliderType } from "../../systems/physics/colliderTypes";
import { realmConfig } from "../realmConfig";

const { HEIGHTMAP_GRID_SIZE, MAP_SIZE } = realmConfig;

export const createInnerTerrainCollider = (heights: Float32Array) => {
  const cellCount = HEIGHTMAP_GRID_SIZE - 1;
  const colliderDesc = ColliderDesc.heightfield(
    cellCount,
    cellCount,
    heights,
    {
      x: MAP_SIZE,
      y: 1,
      z: MAP_SIZE,
    },
    HeightFieldFlags.FIX_INTERNAL_EDGES,
  )
    .setFriction(1)
    .setFrictionCombineRule(CoefficientCombineRule.Max)
    .setRestitution(0.2);
  physicsWorld.world.createCollider(colliderDesc).userData = {
    type: RevoColliderType.Terrain,
  };
};
