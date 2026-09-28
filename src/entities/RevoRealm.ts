import { Terrain } from "./terrain/Terrain";
import { Grass } from "./grass/Grass";
import { Flowers } from "./flowers/Flowers";
import { PineTrees } from "./pineTrees/PineTrees";
import { WindParticles } from "./wind/WindParticles";
import { WindStreaks } from "./wind/WindStreaks";
import { LeviathanAxe } from "./landmarks/LeviathanAxe";
import { DragonSlayerSword } from "./landmarks/DragonSlayerSword";
import { GokuStatue } from "./landmarks/GokuStatue";
// import { Expedition33Flag } from "./landmarks/expedition33Flag/Expedition33Flag";
import { Water } from "./water/Water";
import { Campfire } from "./landmarks/campfire/Campfire";
import { FootballPitch } from "./landmarks/FootballPitch";

export class RevoRealm {
  constructor() {
    new Terrain();
    new Grass();
    new Flowers();
    new PineTrees();
    new WindParticles();
    new WindStreaks();
    new LeviathanAxe();
    new DragonSlayerSword();
    new GokuStatue();
    // new Expedition33Flag();
    new Water();
    new Campfire();
    new FootballPitch();
  }
}
