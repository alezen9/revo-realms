import Grass from "./Grass";
import Flowers from "./Flowers";
import { WaterLilies } from "./WaterLilies";
import Trees from "./Trees";

export default class Vegetation {
  constructor() {
    new Grass();
    new WaterLilies();
    new Flowers();
    new Trees();
  }
}
