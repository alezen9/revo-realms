import { Vector2 } from "three";
import { eventsManager } from "../systems/EventsManager";
import compassUrl from "/textures/hud/compass.webp?url";
import arrowUrl from "/textures/hud/compassArrow.webp?url";
import { realmConfig } from "../realms/PortfolioRealm";

export class Compass {
  constructor() {
    const container = document.createElement("div");
    container.classList.add("compass-container");

    const compass = document.createElement("img");
    compass.setAttribute("alt", "compass");
    compass.setAttribute("src", compassUrl);
    compass.classList.add("compass");
    container.appendChild(compass);

    const arrow = document.createElement("img");
    arrow.setAttribute("alt", "arrow");
    arrow.setAttribute("src", arrowUrl);
    arrow.classList.add("compass-arrow");
    container.appendChild(arrow);

    document.body.appendChild(container);

    const playerPos = new Vector2();
    const distanceThreshold = realmConfig.MAP_SIZE / 2;

    eventsManager.on("update-throttle-16x", ({ player }) => {
      const isFarX = Math.abs(player.position.x) > distanceThreshold;
      const isFarZ = Math.abs(player.position.z) > distanceThreshold;
      const isFar = isFarX || isFarZ;
      const opacity = isFar ? 0.65 : 0;
      container.style.setProperty("--opacity", `${opacity}`);

      if (!opacity) return;
      playerPos.set(player.position.x, player.position.z);
      // PI/2 to shift origin to be -Z and PI to invert direction -> +3PI/2 -> same as -PI/2
      const angleToCenter = playerPos.angle() - Math.PI / 2;
      // account for player rotation as well
      const relativeAngle = angleToCenter + player.yaw;
      arrow.style.setProperty("--yaw", `${relativeAngle}rad`);
    });
  }
}
