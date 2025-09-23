import Grass from "./Grass";
import Flowers from "./Flowers";
import { WaterLilies } from "./WaterLilies";
import Trees from "./Trees";
// import Leaves from "./Leaves";

export default class Vegetation {
  constructor() {
    new Grass();
    new WaterLilies();
    new Flowers();
    new Trees();
    // new Leaves(); // not ready yet but pretty good already
  }
}
