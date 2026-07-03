import { Color, Vector2, Vector3 } from "three/webgpu";
import { uniform } from "three/tsl";
import { debugManager, eventsManager, windManager } from "../../systems";
import WindAmbianceLines from "./WindAmbianceLines";
import WindAmbianceParticles from "./WindAmbianceParticles";

const config = {
  WIND_INTENSITY_THRESHOLD: 0.3,
};

const uniforms = {
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),
  uPlayerPosition: uniform(new Vector3()),
  uDelta: uniform(0),
  uEffectFade: uniform(0),
  uResetAll: uniform(0),
  uEventSeed: uniform(0),
  uColor: uniform(new Color().setRGB(0.78, 0.76, 0.68)),
  uSpeed: uniform(0.58),
  uHeight: uniform(5.5),
};

export type WindAmbianceUniforms = typeof uniforms;

export default class WindAmbiance {
  private particles = new WindAmbianceParticles(uniforms);
  private lines = new WindAmbianceLines(uniforms);
  private meshAnchor = new Vector3();
  private isComputeInFlight = false;
  private shouldResetState = false;
  private wasActive = false;
  private effectFade = 0;
  private eventSeed = 0;

  constructor() {
    eventsManager.on("engine-update", ({ player, delta }) => {
      const deltaX = player.position.x - this.meshAnchor.x;
      const deltaZ = player.position.z - this.meshAnchor.z;
      this.meshAnchor.copy(player.position).setY(0);

      uniforms.uPlayerDeltaXZ.value.set(deltaX, deltaZ);
      uniforms.uPlayerPosition.value.copy(player.position);
      uniforms.uDelta.value = delta;
      this.particles.syncPlayerPosition(this.meshAnchor);
      this.lines.syncPlayerPosition(this.meshAnchor);

      const isActive =
        windManager.uIntensity.value > config.WIND_INTENSITY_THRESHOLD + 0.08;

      if (isActive && !this.wasActive) {
        this.eventSeed += 1;
        uniforms.uEventSeed.value = this.eventSeed;
        this.shouldResetState = true;
      }

      this.effectFade += delta * (isActive ? 3.5 : -1.4);
      this.effectFade = Math.max(0, Math.min(1, this.effectFade));
      uniforms.uEffectFade.value = this.effectFade;
      this.wasActive = isActive;

      const isVisible = this.effectFade > 0.001 || isActive;
      this.particles.setVisible(isVisible);
      this.lines.setVisible(isVisible);
      if (!isVisible || this.isComputeInFlight) return;

      uniforms.uResetAll.value = this.shouldResetState ? 1 : 0;
      this.shouldResetState = false;
      this.isComputeInFlight = true;
      this.lines
        .update()
        .then(() => this.particles.update())
        .catch((error) => {
          console.error("[WindAmbiance] computeAsync failed:", error);
        })
        .finally(() => {
          uniforms.uResetAll.value = 0;
          this.isComputeInFlight = false;
        });
    });

    this.debug();
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🌬️ Wind ambiance",
      expanded: false,
    });

    folder.addBinding(uniforms.uColor, "value", {
      label: "Color",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.uSpeed, "value", {
      label: "Speed",
      min: 0,
      max: 3,
      step: 0.01,
    });
    folder.addBinding(uniforms.uHeight, "value", {
      label: "Height",
      min: 0.5,
      max: 12,
      step: 0.1,
    });
  }
}
