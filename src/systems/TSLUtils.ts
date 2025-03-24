import { Fn, vec2 } from "three/tsl";
import { realmConfig } from "../realms/PortfolioRealm";

class TSLUtils {
  computeMapUvByPosition = Fn(([pos = vec2(0)]) => {
    return pos.add(realmConfig.HALF_MAP_SIZE).div(realmConfig.MAP_SIZE);
  });
}

export const tslUtils = new TSLUtils();
