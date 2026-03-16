import Grass from "./Grass";
import Flowers from "./Flowers";
import PineTrees from "./PineTrees";
import WaterLilies from "./WaterLilies";
import Trees from "./Trees";
import { BigTree } from "./BigTree";
import { Tree } from "./Tree";
import Rocks from "../Rocks";
// import Leaves from "./Leaves";

export default class Vegetation {
  constructor() {
    new Grass();
    new Flowers();
    new PineTrees();
    // new WaterLilies();
    // new Trees();
    // new Leaves(); // not ready yet but pretty good already
    // new BigTree();
    // new Tree();
    // new Rocks();
  }
}
