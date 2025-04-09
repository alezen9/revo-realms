import { uniform } from "three/tsl";

export type UniformType<T> = ReturnType<typeof uniform<T>>;

export enum RevoColliderType {
  Player = "Player",
  Terrain = "Terrain",
  // ######## //
  Wood = "Wood",
  Stone = "Stone",
}
