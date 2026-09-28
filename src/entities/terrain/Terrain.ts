import { InnerTerrain } from "./InnerTerrain";
import { OuterTerrain } from "./OuterTerrain";
import { TerrainMaterial } from "./TerrainMaterial";

export class Terrain {
  constructor() {
    const terrainMaterial = new TerrainMaterial();
    new InnerTerrain(terrainMaterial);
    new OuterTerrain(terrainMaterial);
  }
}
