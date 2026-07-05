import Grass from "./Grass/Grass";
import Flowers from "./Flowers";
import PineTrees from "./PineTrees";

export default class Vegetation {
  constructor() {
    new Grass();
    new Flowers();
    new PineTrees();
  }
}
