import {
  BatchedMesh,
  DataTexture,
  FloatType,
  LinearFilter,
  Mesh,
  NoColorSpace,
  RedFormat,
} from "three/webgpu";
import { realmConfig } from "../realmConfig";
import { assets, stage } from "../../systems";
import { createInnerTerrainCollider } from "./InnerTerrainCollider";
import type { TerrainMaterial } from "./TerrainMaterial";

const { HEIGHTMAP_GRID_SIZE } = realmConfig;

export class InnerTerrain {
  constructor(terrainMaterial: TerrainMaterial) {
    const innerTerrain = this.createInnerTerrainMesh();
    innerTerrain.material = terrainMaterial;
    stage.mainScene.add(innerTerrain);
    const heights = this.getHeights();
    assets.resources.heightmap.copy(this.createHeightmapTexture(heights));
    createInnerTerrainCollider(heights);
  }

  private createInnerTerrainMesh() {
    const terrain = assets.getObject("terrain", assets.resources.terrainModel);
    terrain.updateMatrixWorld(true);

    const tiles: Mesh[] = [];
    let vertexCount = 0;
    let indexCount = 0;
    for (const tile of terrain.children) {
      if (!(tile instanceof Mesh))
        throw new Error(`Terrain tile "${tile.name}" is not a mesh`);
      const { index, attributes } = tile.geometry;
      if (!index) throw new Error(`Terrain tile "${tile.name}" has no index`);
      tiles.push(tile);
      vertexCount += attributes.position.count;
      indexCount += index.count;
    }

    const innerTerrain = new BatchedMesh(tiles.length, vertexCount, indexCount);
    innerTerrain.name = "terrain";
    innerTerrain.perObjectFrustumCulled = true;
    innerTerrain.sortObjects = false;
    for (const tile of tiles) {
      const geometryId = innerTerrain.addGeometry(tile.geometry);
      const instanceId = innerTerrain.addInstance(geometryId);
      innerTerrain.setMatrixAt(instanceId, tile.matrixWorld);
    }
    innerTerrain.computeBoundingSphere();
    return innerTerrain;
  }

  private getHeights() {
    const { buffer, byteOffset, byteLength } = assets.resources.heightmapData;
    const heights = new Float32Array(
      buffer,
      byteOffset,
      byteLength / Float32Array.BYTES_PER_ELEMENT,
    );
    const gridSize = HEIGHTMAP_GRID_SIZE;
    const hasFullGrid = heights.length === gridSize * gridSize;
    if (!hasFullGrid)
      throw new Error(
        `Heightmap has ${heights.length} heights, expected ${gridSize}x${gridSize}`,
      );
    return heights;
  }

  private createHeightmapTexture(heights: Float32Array) {
    const gridSize = HEIGHTMAP_GRID_SIZE;
    const heightmapData = new Float32Array(heights.length);
    let minHeight = Infinity;
    let maxHeight = -Infinity;
    for (let targetIndex = 0; targetIndex < heights.length; targetIndex++) {
      const x = targetIndex % gridSize;
      const z = Math.floor(targetIndex / gridSize);
      const sourceZ = gridSize - 1 - z;
      const sourceIndex = sourceZ + x * gridSize;
      const height = heights[sourceIndex];
      heightmapData[targetIndex] = height;
      minHeight = Math.min(minHeight, height);
      maxHeight = Math.max(maxHeight, height);
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
    heightmap.userData = { min: minHeight, max: maxHeight };
    heightmap.needsUpdate = true;
    return heightmap;
  }
}
