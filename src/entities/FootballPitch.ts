import { Vector3 } from "three";
import { landmarkManager, windManager } from "../systems";

const POSITION = new Vector3(-15, 0.5, -165);
const ARRIVAL_RADIUS = 35;

export class FootballPitch {
  constructor() {
    const landmarkId = landmarkManager.register({
      name: "Football Pitch",
      icon: "football",
      position: POSITION,
      discoveryRadius: 100,
      arrivalRadius: ARRIVAL_RADIUS,
    });
    const windTargetId = windManager.registerTarget(
      "Football Pitch",
      POSITION,
      ARRIVAL_RADIUS,
    );
    landmarkManager.setWindTargetId(landmarkId, windTargetId);
  }
}
