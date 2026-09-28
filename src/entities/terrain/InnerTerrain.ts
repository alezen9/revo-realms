import {
  DataTexture,
  FloatType,
  Group,
  LinearFilter,
  Mesh,
  NoColorSpace,
  RedFormat,
} from "three/webgpu";
import { ColliderDesc, HeightFieldFlags } from "@dimforge/rapier3d";
import { realmConfig } from "../realmConfig";
import { RevoColliderType } from "../../systems/physics/colliderTypes";
import { assets, physicsWorld, stage, graphics } from "../../systems";
import type { TerrainMaterial } from "./TerrainMaterial";

export class InnerTerrain {
  constructor(material: TerrainMaterial) {
    const innerTerrain = this.createInnerTerrain(material);
    stage.mainScene.add(innerTerrain);
  }

  private createInnerTerrain(material: TerrainMaterial) {
    const terrainMeshes = assets.resources.worldModel.scene.children.filter(
      (object): object is Mesh =>
        object instanceof Mesh &&
        object.name.startsWith("terrain-") &&
        object.name !== "terrain-outer",
    );
    let heightfieldMesh: Mesh | undefined;
    const innerTerrain = new Group();
    for (const mesh of terrainMeshes) {
      if (mesh.name === "terrain-heightfield") {
        heightfieldMesh = mesh;
      } else {
        mesh.material = material;
        mesh.geometry.computeBoundingSphere();
        mesh.geometry.computeBoundingBox();
        innerTerrain.add(mesh);
        graphics.vsmPass.registerCaster(mesh);
      }
    }

    if (!heightfieldMesh) {
      throw new Error("No heightfield");
    }

    this.createHeightfieldPhysics(heightfieldMesh);
    return innerTerrain;
  }

  private getHeightfieldData(mesh: Mesh) {
    // every vertex stores the same displacement
    const displacement = mesh.geometry.attributes._displacement.array[0];
    const positionAttribute = mesh.geometry.attributes.position;
    mesh.geometry.computeBoundingBox();
    const boundingBox = mesh.geometry.boundingBox!;
    const vertexCount = positionAttribute.count;
    const gridSize = Math.sqrt(vertexCount);

    // the plane is a square centered at the origin in blender
    const halfExtent = boundingBox.max.x;
    const heights = new Float32Array(vertexCount);
    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
      const positionOffset = vertexIndex * 3;
      const x = positionAttribute.array[positionOffset];
      const y = positionAttribute.array[positionOffset + 1];
      const z = positionAttribute.array[positionOffset + 2];
      const gridX = Math.round((x / (halfExtent * 2) + 0.5) * (gridSize - 1));
      const gridZ = Math.round((z / (halfExtent * 2) + 0.5) * (gridSize - 1));
      const heightIndex = gridZ + gridX * gridSize;
      heights[heightIndex] = y;
    }

    return {
      gridSize,
      heights,
      displacement,
    };
  }

  private createHeightmapTexture(
    gridSize: number,
    heights: Float32Array,
    displacement: number,
  ) {
    const heightmapData = new Float32Array(heights.length);
    let min = 0;
    let max = 0;
    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        const sourceZ = gridSize - 1 - z;
        const sourceX = x;
        const sourceIndex = sourceZ + sourceX * gridSize;
        const targetIndex = x + z * gridSize;
        const height = heights[sourceIndex] - displacement;
        heightmapData[targetIndex] = height;
        if (height < min) min = height;
        if (height > max) max = height;
      }
    }

    const heightmap = new DataTexture(
      heightmapData,
      gridSize,
      gridSize,
      RedFormat,
      FloatType,
    );
    heightmap.name = "terrain.heightmap";
    heightmap.colorSpace = NoColorSpace;
    heightmap.magFilter = LinearFilter;
    heightmap.minFilter = LinearFilter;
    heightmap.generateMipmaps = false;
    heightmap.needsUpdate = true;
    heightmap.userData = {
      min,
      max,
    };
    return heightmap;
  }

  private createHeightfieldPhysics(heightfieldMesh: Mesh) {
    const { gridSize, heights, displacement } =
      this.getHeightfieldData(heightfieldMesh);
    const heightmap = this.createHeightmapTexture(
      gridSize,
      heights,
      displacement,
    );
    assets.resources.heightmap.copy(heightmap);
    const colliderDesc = ColliderDesc.heightfield(
      gridSize - 1,
      gridSize - 1,
      heights,
      {
        x: realmConfig.MAP_SIZE,
        y: 1,
        z: realmConfig.MAP_SIZE,
      },
      HeightFieldFlags.FIX_INTERNAL_EDGES,
    )
      .setTranslation(0, -displacement, 0)
      .setFriction(1)
      .setRestitution(0.2);
    physicsWorld.world.createCollider(colliderDesc).userData = {
      type: RevoColliderType.Terrain,
    };
  }
}
