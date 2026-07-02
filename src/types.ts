export enum RevoColliderType {
  Player = "Player",
  Terrain = "Terrain",
  Wood = "Wood",
  Stone = "Stone",
}

export type ColliderUserData = {
  type?: RevoColliderType;
};
