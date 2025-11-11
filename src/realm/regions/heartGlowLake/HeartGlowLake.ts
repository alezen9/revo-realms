import { Campfire } from "./Campfire";
import { LakeSurface } from "./LakeSurface";
import { Log } from "./Log";

export class HeartGlowLake {
  constructor() {
    new LakeSurface();
    new Campfire();
    new Log();
  }
}
