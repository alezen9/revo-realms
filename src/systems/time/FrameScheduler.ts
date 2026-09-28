const DEFAULT_TARGET_FPS = 120;
const CALIBRATION_FRAME_COUNT = 61;
const MAX_REFRESH_SAMPLE_SECONDS = 0.05;
const REFRESH_RATES = [
  30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 240,
] as const;
const MIN_RENDER_FPS_OPTION = 30;

const getFrameDeltas = (timestamps: number[]) => {
  const deltas: number[] = [];
  for (let index = 1; index < timestamps.length; index++) {
    const delta = timestamps[index] - timestamps[index - 1];
    const isPlausible = delta > 0 && delta <= MAX_REFRESH_SAMPLE_SECONDS;
    if (isPlausible) deltas.push(delta);
  }
  return deltas;
};

const getMedian = (sortedValues: number[]) => {
  const middle = Math.floor(sortedValues.length / 2);
  const hasOddCount = sortedValues.length % 2 === 1;
  if (hasOddCount) return sortedValues[middle];
  return (sortedValues[middle - 1] + sortedValues[middle]) / 2;
};

const getNearestRefreshRate = (measuredHz: number) => {
  let nearest: number = REFRESH_RATES[0];
  let nearestDistance = Math.abs(measuredHz - nearest);
  for (const rate of REFRESH_RATES) {
    const distance = Math.abs(measuredHz - rate);
    if (distance >= nearestDistance) continue;
    nearest = rate;
    nearestDistance = distance;
  }
  return nearest;
};

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

    if (!this.initPromise)
      this.initPromise = new Promise<void>(this.startCalibration);
    return this.initPromise;
  }

  setRenderDivisor(divisor: number) {
    this.divisor = Math.max(1, divisor);
    this.effectiveFps = this.refreshHz / this.divisor;
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
    if (document.hidden) {
      document.addEventListener("visibilitychange", this.onVisibilityChange);
      return;
    }
    requestAnimationFrame(this.onCalibrationFrame);
  };

  private onVisibilityChange = () => {
    if (document.hidden) return;
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    requestAnimationFrame(this.onCalibrationFrame);
  };

  private onCalibrationFrame = (timestamp: DOMHighResTimeStamp) => {
    this.calibrationTimestamps.push(timestamp / 1000);

    if (this.calibrationTimestamps.length < CALIBRATION_FRAME_COUNT) {
      requestAnimationFrame(this.onCalibrationFrame);
      return;
    }

    const deltas = getFrameDeltas(this.calibrationTimestamps);
    if (deltas.length > 0) {
      deltas.sort((a, b) => a - b);
      this.refreshHz = getNearestRefreshRate(1 / getMedian(deltas));
    }

    this.isInitialized = true;
    this.updateCadence();
    const { resolveCalibration } = this;
    if (resolveCalibration) resolveCalibration();
    this.resolveCalibration = undefined;
    this.initPromise = undefined;
  };

  private updateCadence() {
    this.divisor = Math.max(1, Math.ceil(this.refreshHz / this.targetFps));
    this.effectiveFps = this.refreshHz / this.divisor;
    this.displayFrame = 0;
    this.shouldRender = false;
  }
}
