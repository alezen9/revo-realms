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
  LINE_ACTIVE_INTENSITY_THRESHOLD: 0.31,
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
  private wereLinesActive = false;
  private effectFade = 0;
  private eventSeed = 0;

  constructor() {
    this.registerPrewarmTasks();
    this.particles.show();
    eventsManager.on("engine-update", this.onEngineUpdate);
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

    const intensityDirectional = windManager.uIntensityDirectional.value;
    const areLinesActive =
      intensityDirectional > config.LINE_ACTIVE_INTENSITY_THRESHOLD;

    this.syncFadeState(areLinesActive, delta);

    this.syncLineUniforms(player.position, deltaX, deltaZ, delta);
    this.syncParticleUniforms(player.position, deltaX, deltaZ, delta);
    this.particles.syncPlayerPosition(this.meshAnchor);
    this.lines.syncPlayerPosition(this.meshAnchor);

    const areLinesVisible = this.effectFade > 0.001 || areLinesActive;
    this.lines.setVisible(areLinesVisible);

    if (areLinesVisible) this.updateLines();
    this.updateParticles();
  };

  private syncFadeState(areLinesActive: boolean, delta: number) {
    if (areLinesActive && !this.wereLinesActive) {
      this.eventSeed += 1;
      this.shouldResetLines = true;
    }

    this.effectFade += delta * (areLinesActive ? 3.5 : -1.4);
    this.effectFade = Math.max(0, Math.min(1, this.effectFade));
    this.lineUniforms.uEffectFade.value = this.effectFade;
    this.wereLinesActive = areLinesActive;
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

    this.isParticleComputeInFlight = true;
    this.particles
      .update()
      .catch((error) => {
        console.error("[WindAmbiance] particle computeAsync failed:", error);
      })
      .finally(() => {
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
    folder.addBinding(this.particleUniforms.uSize, "value", {
      label: "Particle size",
      min: 0.25,
      max: 4,
      step: 0.01,
    });
  }
}
