import "@dimforge/rapier3d";
import type { ColliderUserData } from "./types";

declare module "@dimforge/rapier3d" {
  interface Collider {
    userData?: ColliderUserData;
  }
}
