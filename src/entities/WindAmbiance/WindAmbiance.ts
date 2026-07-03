import { Color, Vector2, Vector3 } from "three/webgpu";
import { uniform } from "three/tsl";
import {
  debugManager,
  eventsManager,
  prewarmManager,
  windManager,
} from "../../systems";
import WindAmbianceLines from "./WindAmbianceLines";
import WindAmbianceParticles from "./WindAmbianceParticles";

const config = {
  WIND_INTENSITY_THRESHOLD: 0.3,
};

export class WindAmbianceUniforms {
  uPlayerDeltaXZ = uniform(new Vector2(0, 0));
  uPlayerPosition = uniform(new Vector3());
  uDelta = uniform(0);
  uEffectFade = uniform(0);
  uResetAll = uniform(0);
  uEventSeed = uniform(0);
  uColor = uniform(new Color().setRGB(0.78, 0.76, 0.68));
  uSpeed = uniform(0.58);
  uHeight = uniform(5.5);
}

export default class WindAmbiance {
  private lineUniforms = new WindAmbianceUniforms();
  private particleUniforms = new WindAmbianceUniforms();
  private particles = new WindAmbianceParticles(this.particleUniforms);
  private lines = new WindAmbianceLines(this.lineUniforms);
  private meshAnchor = new Vector3();
  private isLineComputeInFlight = false;
  private isParticleComputeInFlight = false;
  private shouldResetLines = false;
  private shouldResetParticles = false;
  private wasActive = false;
  private effectFade = 0;
  private eventSeed = 0;

  constructor() {
    prewarmManager.registerTask({
      prepare: () => this.lines.preparePrewarmAsync(),
      restore: () => this.lines.restorePrewarm(),
    });
    prewarmManager.registerTask({
      prepare: () => this.particles.preparePrewarmAsync(),
      restore: () => this.particles.restorePrewarm(),
    });

    eventsManager.on("engine-update", ({ player, delta }) => {
      const deltaX = player.position.x - this.meshAnchor.x;
      const deltaZ = player.position.z - this.meshAnchor.z;
      this.meshAnchor.copy(player.position).setY(0);

      this.syncUniforms(
        this.lineUniforms,
        player.position,
        deltaX,
        deltaZ,
        delta,
      );
      this.syncUniforms(
        this.particleUniforms,
        player.position,
        deltaX,
        deltaZ,
        delta,
      );
      this.particles.syncPlayerPosition(this.meshAnchor);
      this.lines.syncPlayerPosition(this.meshAnchor);

      const isActive =
        windManager.uIntensity.value > config.WIND_INTENSITY_THRESHOLD + 0.08;

      if (isActive && !this.wasActive) {
        this.eventSeed += 1;
        this.shouldResetLines = true;
        this.shouldResetParticles = true;
      }

      this.effectFade += delta * (isActive ? 3.5 : -1.4);
      this.effectFade = Math.max(0, Math.min(1, this.effectFade));
      this.lineUniforms.uEffectFade.value = this.effectFade;
      this.particleUniforms.uEffectFade.value = this.effectFade;
      this.wasActive = isActive;

      const isVisible = this.effectFade > 0.001 || isActive;
      this.particles.setVisible(isVisible);
      this.lines.setVisible(isVisible);
      if (!isVisible) return;

      this.updateLines();
      this.updateParticles();
    });

    this.debug();
  }

  private syncUniforms(
    uniforms: WindAmbianceUniforms,
    playerPosition: Vector3,
    deltaX: number,
    deltaZ: number,
    delta: number,
  ) {
    uniforms.uPlayerDeltaXZ.value.set(deltaX, deltaZ);
    uniforms.uPlayerPosition.value.copy(playerPosition);
    uniforms.uDelta.value = delta;
    uniforms.uEventSeed.value = this.eventSeed;
    uniforms.uSpeed.value = this.lineUniforms.uSpeed.value;
    uniforms.uHeight.value = this.lineUniforms.uHeight.value;
  }

  private updateLines() {
    if (this.isLineComputeInFlight) return;

    this.lineUniforms.uResetAll.value = this.shouldResetLines ? 1 : 0;
    this.shouldResetLines = false;
    this.isLineComputeInFlight = true;
    this.lines
      .update()
      .catch((error) => {
        console.error("[WindAmbiance] line computeAsync failed:", error);
      })
      .finally(() => {
        this.lineUniforms.uResetAll.value = 0;
        this.isLineComputeInFlight = false;
      });
  }

  private updateParticles() {
    if (this.isParticleComputeInFlight) return;

    this.particleUniforms.uResetAll.value = this.shouldResetParticles ? 1 : 0;
    this.shouldResetParticles = false;
    this.isParticleComputeInFlight = true;
    this.particles
      .update()
      .catch((error) => {
        console.error("[WindAmbiance] particle computeAsync failed:", error);
      })
      .finally(() => {
        this.particleUniforms.uResetAll.value = 0;
        this.isParticleComputeInFlight = false;
      });
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🌬️ Wind ambiance",
      expanded: false,
    });

    folder.addBinding(this.lineUniforms.uColor, "value", {
      label: "Color",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(this.lineUniforms.uSpeed, "value", {
      label: "Speed",
      min: 0,
      max: 3,
      step: 0.01,
    });
    folder.addBinding(this.lineUniforms.uHeight, "value", {
      label: "Height",
      min: 0.5,
      max: 12,
      step: 0.1,
    });
  }
}
