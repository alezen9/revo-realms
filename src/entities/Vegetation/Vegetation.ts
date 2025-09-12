import Grass from "./Grass";
import Flowers from "./Flowers";
import { WaterLilies } from "./WaterLilies";
import Trees from "./Trees";
import NewGrass from "./Grass2.0/GrassField";

export default class Vegetation {
  constructor() {
    // new Grass();
    new NewGrass();
    new WaterLilies();
    new Flowers();
    new Trees();
  }
}
