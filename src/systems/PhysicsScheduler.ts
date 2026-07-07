import type { EventsManager } from "./EventsManager";
import type { PhysicsManager } from "./PhysicsManager";

const BASE_TIMESTEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 8;

export class PhysicsScheduler {
  private physicsManager: PhysicsManager;
  private timeScale = 1;
  private timestep = BASE_TIMESTEP;
  private accumulator = 0;
  private _didStep = false;
  steps = 0;

  constructor(
    eventsManager: EventsManager,
    physicsManager: PhysicsManager,
  ) {
    this.physicsManager = physicsManager;
    eventsManager.on("engine-time-scale", this.onTimeScaleChange);
  }

  private onTimeScaleChange = (scale: number) => {
    this.timeScale = Math.max(0, scale);
    if (this.timeScale === 0) return;
    this.timestep = BASE_TIMESTEP * this.timeScale;
  };

  get alpha() {
    return this.accumulator / this.timestep;
  }

  get didStep() {
    return this._didStep;
  }

  update(delta: number) {
    this.accumulator += delta;
    this.steps = 0;

    while (
      this.accumulator >= this.timestep &&
      this.steps < MAX_STEPS_PER_FRAME
    ) {
      const didStep = this.physicsManager.step(this.timestep);
      if (!didStep) break;

      this.accumulator -= this.timestep;
      this.steps++;
    }

    this._didStep = this.steps > 0;
    if (this.accumulator > this.timestep) this.accumulator = this.timestep;
    this.physicsManager.completeStepBatch(this._didStep);
  }
}
