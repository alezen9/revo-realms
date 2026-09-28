import { Vector3 } from "three";
import { landmarks } from "../../systems";

const POSITION = new Vector3(-15, 0.5, -165);
const ARRIVAL_RADIUS = 35;

export class FootballPitch {
  constructor() {
    landmarks.register({
      name: "Football Pitch",
      icon: "football",
      position: POSITION,
      arrivalRadius: ARRIVAL_RADIUS,
    });
  }
}
