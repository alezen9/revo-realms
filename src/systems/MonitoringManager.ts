import Stats from "stats-gl";

export default class MonitoringManager {
  stats: Stats;
  constructor() {
    const stats = new Stats({
      trackGPU: false,
      logsPerSecond: 4,
      graphsPerSecond: 30,
      samplesLog: 40,
      samplesGraph: 10,
      horizontal: false,
      precision: 2,
      mode: 2,
    });
    document.body.appendChild(stats.dom);
    this.stats = stats;
  }
}
