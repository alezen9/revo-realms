const FIXED_DELTA = 1 / 60;
const MAX_STEPS_PER_FRAME = 4;

export class PhysicsScheduler {
  private accumulator = 0;
  pendingSteps = 0;
  fixedDelta = FIXED_DELTA;

  get alpha() {
    return this.accumulator / this.fixedDelta;
  }

  get didStep() {
    return this.pendingSteps > 0;
  }

  update(delta: number) {
    this.accumulator += delta;
    this.pendingSteps = Math.min(
      Math.floor(this.accumulator / this.fixedDelta),
      MAX_STEPS_PER_FRAME,
    );
    this.accumulator -= this.pendingSteps * this.fixedDelta;
    if (this.accumulator > this.fixedDelta) this.accumulator = this.fixedDelta;
  }
}
