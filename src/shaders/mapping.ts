import { Fn } from "three/tsl";
import type { Node } from "three/webgpu";
import { realmConfig } from "../entities/realmConfig";

export const computeMapUvByPosition = Fn<[pos: Node<"vec2">], Node<"vec2">>(
  ([pos]) => pos.add(realmConfig.HALF_MAP_SIZE).div(realmConfig.MAP_SIZE),
);
