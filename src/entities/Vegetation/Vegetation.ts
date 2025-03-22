import Grass from "./Grass";
import { Flowers } from "./Flowers";
import { WaterLilies } from "./WaterLilies";

export default class Vegetation {
  constructor() {
    new Grass();
    new WaterLilies();
    new Flowers();
  }
}
