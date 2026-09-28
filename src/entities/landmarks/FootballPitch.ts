import { Vector3 } from "three";
import { landmarks, wind } from "../../systems";

const POSITION = new Vector3(-15, 0.5, -165);
const ARRIVAL_RADIUS = 35;

export class FootballPitch {
  constructor() {
    const landmarkId = landmarks.register({
      name: "Football Pitch",
      icon: "football",
      position: POSITION,
      arrivalRadius: ARRIVAL_RADIUS,
    });
    const windTargetId = wind.registerTarget(
      "Football Pitch",
      POSITION,
      ARRIVAL_RADIUS,
    );
    landmarks.setWindTargetId(landmarkId, windTargetId);
  }
}
