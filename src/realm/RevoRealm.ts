import CoolStuff from "../entities/CoolStuff/CoolStuff";
import Terrain from "../entities/Terrain";
import Vegetation from "../entities/Vegetation/Vegetation";
import { LakeSurface } from "../entities/LakeSurface";
import { Campfire } from "../entities/Campfire";
export { realmConfig } from "./config";

export default class PortfolioRealm {
  constructor() {
    new Terrain();
    new Vegetation();
    new CoolStuff();
    new LakeSurface();
    new Campfire();
  }
}
