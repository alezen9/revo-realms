import { Vector3 } from "three";
import type { State } from "../Game";
import type { EventsManager } from "./EventsManager";

export type Landmark = {
  id: string;
  name: string;
  icon: string;
  position: Vector3;
  discoveryRadius: number;
  arrivalRadius: number;
  hasBeenDiscovered: boolean;
  windTargetId?: string; // ID from wind system for activation
};

type LandmarkRegistration = Omit<Landmark, "id" | "hasBeenDiscovered" | "windTargetId">;

export class LandmarkManager {
  private landmarks = new Map<string, Landmark>();
  private idCounter = 0;
  private eventsManager: EventsManager;

  constructor(eventsManager: EventsManager) {
    this.eventsManager = eventsManager;
    eventsManager.on(
      "engine-update-throttle-16x",
      this.checkDiscovery.bind(this),
    );
  }

  register(registration: LandmarkRegistration): string {
    const id = `landmark-${++this.idCounter}`;
    const landmark: Landmark = {
      ...registration,
      id,
      hasBeenDiscovered: false,
    };
    this.landmarks.set(id, landmark);
    return id;
  }

  discover(id: string): void {
    const landmark = this.landmarks.get(id);
    if (!landmark || landmark.hasBeenDiscovered) return;
    landmark.hasBeenDiscovered = true;
    this.eventsManager.emit("landmark-discovered", id);
  }

  isDiscovered(id: string): boolean {
    return this.landmarks.get(id)?.hasBeenDiscovered ?? false;
  }

  getAll(): Landmark[] {
    return Array.from(this.landmarks.values());
  }

  getDiscovered(): Landmark[] {
    return this.getAll().filter((l) => l.hasBeenDiscovered);
  }

  getById(id: string): Landmark | undefined {
    return this.landmarks.get(id);
  }

  setWindTargetId(landmarkId: string, windTargetId: string): void {
    const landmark = this.landmarks.get(landmarkId);
    if (landmark) {
      landmark.windTargetId = windTargetId;
    }
  }

  private checkDiscovery(state: State): void {
    const playerPos = state.player.position;

    this.landmarks.forEach((landmark) => {
      if (landmark.hasBeenDiscovered) return;

      const dx = playerPos.x - landmark.position.x;
      const dz = playerPos.z - landmark.position.z;
      const distanceSq = dx * dx + dz * dz;
      const discoveryRadiusSq =
        landmark.discoveryRadius * landmark.discoveryRadius;

      if (distanceSq <= discoveryRadiusSq) {
        this.discover(landmark.id);
      }
    });
  }
}
