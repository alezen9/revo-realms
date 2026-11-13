import { Terrain } from "./terrain/Terrain";
import { Grass } from "./grass/Grass";
import { Flowers } from "./flowers/Flowers";
import { Pampas } from "./pampas/Pampas";
import { PineTrees } from "./pineTrees/PineTrees";
import { WindParticles } from "./wind/WindParticles";
import { WindStreaks } from "./wind/WindStreaks";
import { LeviathanAxe } from "./landmarks/LeviathanAxe";
import { DragonSlayerSword } from "./landmarks/dragonSlayerSword/DragonSlayerSword";
import { GokuStatue } from "./landmarks/gokuStatue/GokuStatue";
import { Expedition33Flag } from "./landmarks/expedition33Flag/Expedition33Flag";
import { Water } from "./water/Water";
import { Koi } from "./koi/Koi";
import { LakeRocks } from "./lakeRocks/LakeRocks";
import { WaterLilies } from "./waterLilies/WaterLilies";
import { LakePlants } from "./lakePlants/LakePlants";
import { Campfire } from "./landmarks/campfire/Campfire";
import { FootballPitch } from "./landmarks/FootballPitch";

export class RevoRealm {
  constructor() {
    new Terrain();
    new Grass();
    new Flowers();
    new Pampas();
    new PineTrees();
    new WindParticles();
    new WindStreaks();
    new LeviathanAxe();
    new DragonSlayerSword();
    new GokuStatue();
    new Expedition33Flag();
    new Water();
    new LakeRocks();
    new Koi();
    new WaterLilies();
    new LakePlants();
    new Campfire();
    new FootballPitch();
  }
}
