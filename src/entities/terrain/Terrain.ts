import { InnerTerrain } from "./InnerTerrain";
import { OuterTerrain } from "./OuterTerrain";
import { debugTerrain } from "./TerrainDebug";
import { TerrainMaterial } from "./TerrainMaterial";

export class Terrain {
  constructor() {
    const terrainMaterial = new TerrainMaterial();
    debugTerrain();
    new InnerTerrain(terrainMaterial);
    new OuterTerrain(terrainMaterial);
  }
}
