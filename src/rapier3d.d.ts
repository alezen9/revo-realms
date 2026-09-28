import "@dimforge/rapier3d";
import type { ColliderUserData } from "./systems/physics/colliderTypes";

declare module "@dimforge/rapier3d" {
  interface Collider {
    userData?: ColliderUserData;
  }
}
