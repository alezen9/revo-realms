const FIXED_DELTA = 1 / 60;

export class PhysicsScheduler {
  private accumulator = 0;
  shouldStep = false;
  steps = 0;
  fixedDelta = FIXED_DELTA;

  get alpha() {
    return this.accumulator / this.fixedDelta;
  }

  get didStep() {
    return this.shouldStep;
  }

  update(delta: number) {
    this.accumulator += delta;
    this.shouldStep = this.accumulator >= this.fixedDelta;
    this.steps = this.shouldStep ? 1 : 0;

    if (!this.shouldStep) return;
    this.accumulator -= this.fixedDelta;
    if (this.accumulator > this.fixedDelta) this.accumulator = this.fixedDelta;
  }
}
