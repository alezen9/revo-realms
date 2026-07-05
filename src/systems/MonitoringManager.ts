export type MonitoringMetric = {
  id: string;
  group: string;
  label: string;
  unit?: string;
  precision?: number;
  history?: boolean;
  chartMin?: number;
  chartMax?: number;
  warnAt?: number;
  dangerAt?: number;
  getValue: () => number;
};

export type MonitoringMetricSnapshot = {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  unit: string;
  hasHistory: boolean;
  chartMin?: number;
  chartMax?: number;
  warnAt?: number;
  dangerAt?: number;
};

export type MonitoringGroupSnapshot = {
  name: string;
  metrics: MonitoringMetricSnapshot[];
};

export type MonitoringSnapshot = {
  groups: MonitoringGroupSnapshot[];
  updatedAt: number;
};

type MonitoringListener = (snapshot: MonitoringSnapshot) => void;

const DEFAULT_PUBLISH_INTERVAL_IN_MILLISECONDS = 750;

export class MonitoringManager {
  private metrics = new Map<string, MonitoringMetric>();
  private listeners = new Set<MonitoringListener>();
  private snapshot: MonitoringSnapshot = { groups: [], updatedAt: 0 };
  private lastPublishTime = 0;

  registerMetric(metric: MonitoringMetric): VoidFunction {
    this.metrics.set(metric.id, metric);

    return () => {
      this.metrics.delete(metric.id);
    };
  }

  subscribe(listener: MonitoringListener): VoidFunction {
    this.listeners.add(listener);
    listener(this.snapshot);

    return () => {
      this.listeners.delete(listener);
    };
  }

  sample(now = performance.now()) {
    const shouldPublish =
      now - this.lastPublishTime >= DEFAULT_PUBLISH_INTERVAL_IN_MILLISECONDS;
    if (!shouldPublish) return;

    this.lastPublishTime = now;
    this.snapshot = this.createSnapshot(now);
    this.emitSnapshot();
  }

  private createSnapshot(now: number): MonitoringSnapshot {
    const groups = new Map<string, MonitoringMetricSnapshot[]>();

    for (const metric of this.metrics.values()) {
      const value = metric.getValue();
      if (!Number.isFinite(value)) continue;

      const group = groups.get(metric.group) ?? [];
      group.push({
        id: metric.id,
        label: metric.label,
        value,
        formattedValue: this.formatValue(value, metric.precision ?? 0),
        unit: metric.unit ?? "",
        hasHistory: !!metric.history,
        chartMin: metric.chartMin,
        chartMax: metric.chartMax,
        warnAt: metric.warnAt,
        dangerAt: metric.dangerAt,
      });
      groups.set(metric.group, group);
    }

    return {
      groups: [...groups.entries()].map(([name, metrics]) => ({
        name,
        metrics,
      })),
      updatedAt: now,
    };
  }

  private formatValue(value: number, precision: number) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(value);
  }

  private emitSnapshot() {
    for (const listener of this.listeners) listener(this.snapshot);
  }
}
