import CoolStuff from "../entities/CoolStuff/CoolStuff";
import Monuments from "../entities/Monuments";
import Water from "../entities/Water";
import Rocks from "../entities/Rocks";
import Terrain from "../entities/Terrain";
import Vegetation from "../entities/Vegetation/Vegetation";
import { Compass } from "../entities/Compass";

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
  constructor() {
    new Compass();
    new Terrain();
    new Monuments();
    new Water();
    new Vegetation();
    new Rocks();
    new CoolStuff();
  }
}
