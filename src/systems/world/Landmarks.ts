import { Vector3 } from "three";

export type LandmarkIconId =
  "fire" | "water" | "sword" | "axe" | "dragonball" | "flag" | "football";

export type Landmark = {
  id: string;
  name: string;
  icon: LandmarkIconId;
  position: Vector3;
  arrivalRadius: number;
};

type LandmarkRegistration = Omit<Landmark, "id">;

export class Landmarks {
  private landmarks = new Map<string, Landmark>();
  private idCounter = 0;

  register(registration: LandmarkRegistration): string {
    const id = `landmark-${++this.idCounter}`;
    this.landmarks.set(id, { ...registration, id });
    return id;
  }

  getAll(): Landmark[] {
    return Array.from(this.landmarks.values());
  }

  getById(id: string): Landmark | undefined {
    return this.landmarks.get(id);
  }
}
