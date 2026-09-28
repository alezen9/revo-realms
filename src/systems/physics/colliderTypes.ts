export const RevoColliderType = {
  Player: "Player",
  Terrain: "Terrain",
  Wood: "Wood",
  Stone: "Stone",
} as const;

export type RevoColliderType =
  (typeof RevoColliderType)[keyof typeof RevoColliderType];

export type ColliderUserData = {
  type?: RevoColliderType;
};
