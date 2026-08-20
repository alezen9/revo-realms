const FIXED_DELTA = 1 / 60;
export const MAX_CATCH_UP_SECONDS = 1 / 15;
const MAX_STEPS_PER_FRAME = Math.floor(MAX_CATCH_UP_SECONDS / FIXED_DELTA);

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
