import { Mesh, Vector3 } from "three/webgpu";
import {
  CoefficientCombineRule,
  ColliderDesc,
  type RigidBody,
  RigidBodyDesc,
} from "@dimforge/rapier3d";
import { type State } from "../../Game";
import { realmConfig } from "../realmConfig";
import { RevoColliderType } from "../../systems/physics/colliderTypes";
import { assets, eventBus, physicsWorld, stage } from "../../systems";
import type { TerrainMaterial } from "./TerrainMaterial";

const {
  HALF_FLOOR_THICKNESS,
  HALF_MAP_SIZE,
  KINTOUN_ACTIVATION_THRESHOLD,
  MAP_SIZE,
} = realmConfig;

export class OuterTerrain {
  private outerTerrain: Mesh;
  // kintoun is the flying nimbus cloud from dragon ball, a floor that follows the player past the map edge
  private kintoun: RigidBody;
  private kintounPosition = new Vector3();
  constructor(terrainMaterial: TerrainMaterial) {
    this.outerTerrain = this.createOuterTerrainMesh();
    this.outerTerrain.material = terrainMaterial;
    this.kintoun = this.createKintoun();
    stage.mainScene.add(this.outerTerrain);
    eventBus.on("engine-render-update", this.onEngineUpdate);
  }

  private createOuterTerrainMesh() {
    const outerTerrain = assets.getMesh(
      "terrain-outer",
      assets.resources.terrainModel,
    );
    outerTerrain.geometry.computeBoundingSphere();
    outerTerrain.geometry.computeBoundingBox();
    return outerTerrain;
  }

  private createKintoun() {
    const rigidBodyDesc = RigidBodyDesc.kinematicPositionBased().setTranslation(
      0,
      -20,
      0,
    );
    const rigidBody = physicsWorld.world.createRigidBody(rigidBodyDesc);
    const halfSize = 2;
    const colliderDesc = ColliderDesc.cuboid(
      halfSize,
      HALF_FLOOR_THICKNESS,
      halfSize,
    )
      .setFriction(1)
      .setFrictionCombineRule(CoefficientCombineRule.Max)
      .setRestitution(0.2);
    physicsWorld.world.createCollider(colliderDesc, rigidBody).userData = {
      type: RevoColliderType.Terrain,
    };
    return rigidBody;
  }

  private positionKintounUnderPlayer(playerPosition: Vector3) {
    this.kintounPosition.copy(playerPosition).setY(-HALF_FLOOR_THICKNESS);
    this.kintoun.setTranslation(this.kintounPosition, true);
  }

  private onEngineUpdate = (state: State) => {
    const { player } = state;
    const isPlayerNearEdgeX =
      HALF_MAP_SIZE - Math.abs(player.position.x) <
      KINTOUN_ACTIVATION_THRESHOLD;
    const isPlayerNearEdgeZ =
      HALF_MAP_SIZE - Math.abs(player.position.z) <
      KINTOUN_ACTIVATION_THRESHOLD;
    if (isPlayerNearEdgeX || isPlayerNearEdgeZ) {
      this.positionKintounUnderPlayer(player.position);
    }

    const outerTerrainThreshold = MAP_SIZE;
    const absPlayerX = Math.abs(player.position.x);
    const directionX = Math.sign(player.position.x);
    const absPlayerZ = Math.abs(player.position.z);
    const directionZ = Math.sign(player.position.z);
    const offsetX = Math.max(0, absPlayerX - outerTerrainThreshold);
    const offsetZ = Math.max(0, absPlayerZ - outerTerrainThreshold);
    const nextX = offsetX * directionX;
    const nextZ = offsetZ * directionZ;
    if (
      this.outerTerrain.position.x === nextX &&
      this.outerTerrain.position.z === nextZ
    )
      return;
    this.outerTerrain.position.set(nextX, 0, nextZ);
  };
}
