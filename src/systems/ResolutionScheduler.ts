const SCALE_STEPS = [
  0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1,
] as const;
const FULL_SCALE_INDEX = SCALE_STEPS.length - 1;
const SAMPLE_WINDOW = 32;
const OVER_BUDGET_FACTOR = 1.25;
const SCALE_DOWN_MISS_RATIO = 0.1;
const SCALE_DOWN_COOLDOWN_FRAMES = 16;
const SCALE_UP_COOLDOWN_FRAMES = 120;

export class ResolutionScheduler {
  isEnabled = false;
  minStepIndex = 0;
  stepIndex = FULL_SCALE_INDEX;
  scale: number = SCALE_STEPS[FULL_SCALE_INDEX];

  private sampleCount = 0;
  private missCount = 0;
  private framesSinceChange = 0;
  private lastTimestamp = 0;

  get steps() {
    return SCALE_STEPS;
  }

  setEnabled(isEnabled: boolean) {
    this.isEnabled = isEnabled;
    this.sampleCount = 0;
    this.missCount = 0;
    this.framesSinceChange = 0;
  }

  setStepIndex(stepIndex: number) {
    this.stepIndex = Math.min(FULL_SCALE_INDEX, Math.max(0, stepIndex));
    this.scale = SCALE_STEPS[this.stepIndex];
    this.sampleCount = 0;
    this.missCount = 0;
    this.framesSinceChange = 0;
    return this.scale;
  }

  update(timestamp: DOMHighResTimeStamp, budgetMs: number) {
    const previousTimestamp = this.lastTimestamp;
    this.lastTimestamp = timestamp;
    if (!this.isEnabled || previousTimestamp === 0) return false;

    this.framesSinceChange++;
    this.sampleCount++;
    if (timestamp - previousTimestamp > budgetMs * OVER_BUDGET_FACTOR)
      this.missCount++;
    if (this.sampleCount < SAMPLE_WINDOW) return false;

    const missRatio = this.missCount / this.sampleCount;
    this.sampleCount = 0;
    this.missCount = 0;

    if (missRatio > SCALE_DOWN_MISS_RATIO)
      return this.applyStep(this.stepIndex - 1, SCALE_DOWN_COOLDOWN_FRAMES);
    if (missRatio === 0)
      return this.applyStep(this.stepIndex + 1, SCALE_UP_COOLDOWN_FRAMES);
    return false;
  }

  private applyStep(nextStepIndex: number, cooldownFrames: number) {
    if (this.framesSinceChange < cooldownFrames) return false;

    const clampedIndex = Math.min(
      FULL_SCALE_INDEX,
      Math.max(this.minStepIndex, nextStepIndex),
    );
    if (clampedIndex === this.stepIndex) return false;

    this.stepIndex = clampedIndex;
    this.scale = SCALE_STEPS[clampedIndex];
    this.framesSinceChange = 0;
    return true;
  }
}
