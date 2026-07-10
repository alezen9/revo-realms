const DEFAULT_TARGET_FPS = 120;
const CALIBRATION_FRAME_COUNT = 61;
const MAX_REFRESH_SAMPLE_SECONDS = 0.05;
const REFRESH_RATES = [
  30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 240,
] as const;
const MIN_RENDER_FPS_OPTION = 30;

export class FrameScheduler {
  shouldRender = false;
  targetFps = DEFAULT_TARGET_FPS;
  refreshHz = DEFAULT_TARGET_FPS;
  divisor = 1;
  effectiveFps = DEFAULT_TARGET_FPS;

  private isInitialized = false;
  private initPromise?: Promise<void>;
  private calibrationTimestamps: number[] = [];
  private resolveCalibration?: () => void;
  private displayFrame = 0;

  initAsync(targetFps = this.targetFps) {
    this.targetFps = targetFps;
    if (this.isInitialized) {
      this.updateCadence();
      return Promise.resolve();
    }

    this.initPromise ??= new Promise<void>(this.startCalibration);
    return this.initPromise;
  }

  setRenderDivisor(divisor: number) {
    this.divisor = Math.max(1, divisor);
    this.effectiveFps = this.refreshHz / this.divisor;
    this.targetFps = this.effectiveFps;
    this.displayFrame = 0;
    this.shouldRender = false;
  }

  getRenderCadences() {
    const cadences: { divisor: number; fps: number }[] = [];
    let divisor = 1;

    while (this.refreshHz / divisor >= MIN_RENDER_FPS_OPTION) {
      cadences.push({
        divisor,
        fps: this.refreshHz / divisor,
      });
      divisor++;
    }

    return cadences;
  }

  update() {
    this.displayFrame++;
    this.shouldRender = this.displayFrame % this.divisor === 0;
  }

  private startCalibration = (resolve: () => void) => {
    this.resolveCalibration = resolve;
    this.calibrationTimestamps = [];
    requestAnimationFrame(this.onCalibrationFrame);
  };

  private onCalibrationFrame = (timestamp: DOMHighResTimeStamp) => {
    this.calibrationTimestamps.push(timestamp / 1000);

    if (this.calibrationTimestamps.length < CALIBRATION_FRAME_COUNT) {
      requestAnimationFrame(this.onCalibrationFrame);
      return;
    }

    const deltas: number[] = [];

    for (let i = 1; i < this.calibrationTimestamps.length; i++) {
      const delta =
        this.calibrationTimestamps[i] - this.calibrationTimestamps[i - 1];
      if (delta <= 0 || delta > MAX_REFRESH_SAMPLE_SECONDS) continue;
      deltas.push(delta);
    }

    if (deltas.length > 0) {
      deltas.sort((a, b) => a - b);
      const middle = Math.floor(deltas.length / 2);
      const medianDelta =
        deltas.length % 2 === 1
          ? deltas[middle]
          : (deltas[middle - 1] + deltas[middle]) / 2;
      const measuredHz = 1 / medianDelta;
      let nearest: number = REFRESH_RATES[0];
      let nearestDistance = Math.abs(measuredHz - nearest);

      for (const rate of REFRESH_RATES) {
        const distance = Math.abs(measuredHz - rate);
        if (distance >= nearestDistance) continue;
        nearest = rate;
        nearestDistance = distance;
      }

      this.refreshHz = nearest;
    }

    this.isInitialized = true;
    this.updateCadence();
    this.resolveCalibration?.();
    this.resolveCalibration = undefined;
    this.initPromise = undefined;
  };

  private updateCadence() {
    this.divisor = Math.max(1, Math.ceil(this.refreshHz / this.targetFps));
    this.effectiveFps = this.refreshHz / this.divisor;
    this.targetFps = this.effectiveFps;
    this.displayFrame = 0;
    this.shouldRender = false;
  }
}
