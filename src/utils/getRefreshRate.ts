const COMMON_REFRESH_RATES = [30, 60, 120, 144, 160, 165, 170, 180, 240];

const findClosest = (goal: number) =>
  COMMON_REFRESH_RATES.reduce((prev, curr) =>
    Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev,
  );

export const getRefreshRate = async (): Promise<number> => {
  return new Promise((resolve) => {
    const dts: number[] = [];
    let last = performance.now(),
      start = last;
    function tick(t: number) {
      dts.push(t - last);
      last = t;
      if (t - start < 1000) requestAnimationFrame(tick);
      else {
        dts.sort((a, b) => a - b);
        const median = dts[Math.floor(dts.length / 2)] || 16.667;
        const hz = 1000 / median;
        const refreshRate = findClosest(hz);
        resolve(refreshRate);
      }
    }
    requestAnimationFrame(tick);
  });
};
