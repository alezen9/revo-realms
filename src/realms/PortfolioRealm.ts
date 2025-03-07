import { State } from "../Game";
import Grass from "../entities/Grass";
import Monuments from "../entities/Monuments";
import Plants from "../entities/Plants";
import { Terrain } from "../entities/Terrain";
import { Water } from "../entities/Water";

const getConfig = () => {
  const MAP_SIZE = 256;
  return Object.freeze({
    MAP_SIZE,
    HALF_MAP_SIZE: MAP_SIZE / 2,
    KINTOUN_ACTIVATION_THRESHOLD: 2,
    HALF_FLOOR_THICKNESS: 0.3,
    OUTER_MAP_SIZE: MAP_SIZE * 3,
    OUTER_HALF_MAP_SIZE: MAP_SIZE * 1.5,
  });
};

export const realmConfig = getConfig();

export default class PortfolioRealm {
  private terrain: Terrain;
  private plants: Plants;
  private grass: Grass;

  constructor() {
    this.terrain = new Terrain();
    this.plants = new Plants();
    this.grass = new Grass();
    new Monuments();
    new Water();
  }

  async updateAsync(state: State) {
    this.terrain.update(state);
    this.plants.update(state);
    await this.grass.updateAsync(state);
  }
}
