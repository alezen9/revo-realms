import { Vector3 } from "three/webgpu";
import {
  debugManager,
  eventsManager,
  prewarmManager,
  windManager,
} from "../../systems";
import { type State } from "../../Game";
import WindAmbianceLines, { createWindLineUniforms } from "./WindAmbianceLines";
import WindAmbianceParticles, {
  createWindParticleUniforms,
} from "./WindAmbianceParticles";

const config = {
  WIND_INTENSITY_THRESHOLD: 0.3,
};

export default class WindAmbiance {
  private lineUniforms = createWindLineUniforms();
  private particleUniforms = createWindParticleUniforms();
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
    this.registerPrewarmTasks();
    eventsManager.on("engine-render-update", this.onEngineUpdate);
    this.debug();
  }

  private registerPrewarmTasks() {
    prewarmManager.registerTask({
      prepare: () => this.lines.preparePrewarmAsync(),
      restore: () => this.lines.restorePrewarm(),
    });
    prewarmManager.registerTask({
      prepare: () => this.particles.preparePrewarmAsync(),
      restore: () => this.particles.restorePrewarm(),
    });
  }

  private onEngineUpdate = ({ player, delta }: State) => {
    const deltaX = player.position.x - this.meshAnchor.x;
    const deltaZ = player.position.z - this.meshAnchor.z;
    this.meshAnchor.copy(player.position).setY(0);

    this.syncLineUniforms(player.position, deltaX, deltaZ, delta);
    this.syncParticleUniforms(player.position, deltaX, deltaZ, delta);
    this.particles.syncPlayerPosition(this.meshAnchor);
    this.lines.syncPlayerPosition(this.meshAnchor);

    const isActive =
      windManager.uIntensity.value > config.WIND_INTENSITY_THRESHOLD + 0.08;

    this.syncFadeState(isActive, delta);

    const areLinesVisible = this.effectFade > 0.001 || isActive;
    const areParticlesVisible = this.effectFade > 0.001 || isActive;
    this.particles.setVisible(areParticlesVisible);
    this.lines.setVisible(areLinesVisible);
    if (!areLinesVisible && !areParticlesVisible) return;

    if (areLinesVisible) this.updateLines();
    if (areParticlesVisible) this.updateParticles();
  };

  private syncFadeState(isActive: boolean, delta: number) {
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
  }

  private syncLineUniforms(
    playerPosition: Vector3,
    deltaX: number,
    deltaZ: number,
    delta: number,
  ) {
    this.lineUniforms.uPlayerDeltaXZ.value.set(deltaX, deltaZ);
    this.lineUniforms.uPlayerPosition.value.copy(playerPosition);
    this.lineUniforms.uDelta.value = delta;
    this.lineUniforms.uEventSeed.value = this.eventSeed;
  }

  private syncParticleUniforms(
    playerPosition: Vector3,
    deltaX: number,
    deltaZ: number,
    delta: number,
  ) {
    this.particleUniforms.uPlayerDeltaXZ.value.set(deltaX, deltaZ);
    this.particleUniforms.uPlayerPosition.value.copy(playerPosition);
    this.particleUniforms.uDelta.value = delta;
    this.particleUniforms.uEventSeed.value = this.eventSeed;
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
      label: "Line color",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(this.lineUniforms.uSpeed, "value", {
      label: "Line speed",
      min: 0,
      max: 3,
      step: 0.01,
    });
    folder.addBinding(this.lineUniforms.uHeight, "value", {
      label: "Line height",
      min: 0.5,
      max: 12,
      step: 0.1,
    });
    folder.addBinding(this.particleUniforms.uColor, "value", {
      label: "Particle color",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(this.particleUniforms.uSpeed, "value", {
      label: "Particle speed",
      min: 0,
      max: 3,
      step: 0.01,
    });
    folder.addBinding(this.particleUniforms.uHeight, "value", {
      label: "Particle height",
      min: 0.5,
      max: 12,
      step: 0.1,
    });
  }
}
