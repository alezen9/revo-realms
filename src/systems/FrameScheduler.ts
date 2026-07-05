const TARGET_FPS = 60;
const TARGET_DELTA_SECONDS = 1 / TARGET_FPS;
const MAX_ACCUMULATED_SECONDS = 0.1;

type FrameScheduleResult = {
  shouldTick: boolean;
  delta: number;
};

export class FrameScheduler {
  readonly diagnostics = {
    targetFps: TARGET_FPS,
    targetDeltaSeconds: TARGET_DELTA_SECONDS,
    accumulatedSeconds: 0,
    rawDeltaSeconds: 0,
    rafFps: 0,
    acceptedFrameIntervalSeconds: 0,
    frameWorkSeconds: 0,
    skippedRafFramesSinceLastTick: 0,
    skippedRafFrames: 0,
    droppedTimeCount: 0,
  };

  private accumulatedSeconds = 0;
  private elapsedSeconds = 0;
  private lastAcceptedFrameTimeSeconds = 0;
  private skippedRafFramesSinceLastTick = 0;

  reset() {
    this.accumulatedSeconds = 0;
    this.skippedRafFramesSinceLastTick = 0;
    this.diagnostics.accumulatedSeconds = 0;
    this.diagnostics.skippedRafFramesSinceLastTick = 0;
  }

  update(rawDeltaSeconds: number): FrameScheduleResult {
    this.elapsedSeconds += rawDeltaSeconds;
    this.updateRafDiagnostics(rawDeltaSeconds);

    const nextAccumulatedSeconds = this.accumulatedSeconds + rawDeltaSeconds;

    if (nextAccumulatedSeconds > MAX_ACCUMULATED_SECONDS) {
      this.accumulatedSeconds = MAX_ACCUMULATED_SECONDS;
      this.diagnostics.droppedTimeCount += 1;
    } else {
      this.accumulatedSeconds = nextAccumulatedSeconds;
    }

    if (this.accumulatedSeconds < TARGET_DELTA_SECONDS) {
      this.skippedRafFramesSinceLastTick += 1;
      this.diagnostics.skippedRafFrames += 1;
      this.diagnostics.accumulatedSeconds = this.accumulatedSeconds;
      return { shouldTick: false, delta: 0 };
    }

    this.accumulatedSeconds -= TARGET_DELTA_SECONDS;
    if (this.accumulatedSeconds >= TARGET_DELTA_SECONDS) {
      this.accumulatedSeconds %= TARGET_DELTA_SECONDS;
      this.diagnostics.droppedTimeCount += 1;
    }

    this.diagnostics.accumulatedSeconds = this.accumulatedSeconds;
    this.diagnostics.skippedRafFramesSinceLastTick =
      this.skippedRafFramesSinceLastTick;
    this.diagnostics.acceptedFrameIntervalSeconds =
      this.elapsedSeconds - this.lastAcceptedFrameTimeSeconds;
    this.lastAcceptedFrameTimeSeconds = this.elapsedSeconds;
    this.skippedRafFramesSinceLastTick = 0;

    return { shouldTick: true, delta: TARGET_DELTA_SECONDS };
  }

  recordFrameWorkDuration(durationSeconds: number) {
    this.diagnostics.frameWorkSeconds = durationSeconds;
  }

  private updateRafDiagnostics(rawDeltaSeconds: number) {
    this.diagnostics.rawDeltaSeconds = rawDeltaSeconds;
    if (rawDeltaSeconds <= 0) return;

    const rafFps = 1 / rawDeltaSeconds;
    if (this.diagnostics.rafFps === 0) {
      this.diagnostics.rafFps = rafFps;
      return;
    }

    this.diagnostics.rafFps += (rafFps - this.diagnostics.rafFps) * 0.1;
  }
}
