import Grass from "./Grass";
import Flowers from "./Flowers";
import { WaterLilies } from "./WaterLilies";
import Trees from "./Trees";
import GrassTiles from "./GrassTiles/GrassField";
// import Leaves from "./Leaves";

export default class Vegetation {
  constructor() {
    new GrassTiles();
    // new Grass();
    // new WaterLilies();
    // new Flowers();
    // new Trees();
    // new Leaves(); // not ready yet but pretty good already
  }
}
