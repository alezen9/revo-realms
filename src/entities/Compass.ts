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

    const distanceThreshold = realmConfig.MAP_SIZE / 2;
    let relativeAngle = 0;

    eventsManager.on("update-throttle-16x", ({ player }) => {
      const isFarX = Math.abs(player.position.x) > distanceThreshold;
      const isFarZ = Math.abs(player.position.z) > distanceThreshold;
      const isFar = isFarX || isFarZ;
      const opacity = isFar ? 0.65 : 0;
      container.style.setProperty("--opacity", `${opacity}`);

      if (!opacity) return;
      const angleToCenter = Math.atan2(-player.position.x, -player.position.z); // yaw frame

      // unwrap to avoid big jumps
      relativeAngle = this.unwrapAngle(
        relativeAngle,
        angleToCenter - player.yaw,
      );

      // flip for CSS clockwise rotation
      arrow.style.setProperty("--yaw", `${-relativeAngle}rad`);
    });
  }

  private unwrapAngle(prev: number, next: number): number {
    const diff = next - prev;
    return prev + (((diff + Math.PI) % (2 * Math.PI)) - Math.PI);
  }
}
