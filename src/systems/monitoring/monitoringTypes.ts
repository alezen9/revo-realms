import type { ResourceEntry } from "agrimensor";

export type { ResourceEntry };

export type DeviceGpuMetrics = {
  averageMs: number;
  renderAverageMs: number;
  computeAverageMs: number;
  grassComputeAverageMs: number | null;
  gapAverageMs: number;
  uninstrumentedPassMax: number;
  slowestPasses: DeviceGpuPassMetrics[];
};

export type DeviceGpuPassMetrics = {
  kind: "render" | "compute";
  label: string;
  averageMs: number;
};

export type DeviceMetrics = {
  drawCallCount: number;
  renderPassCount: number;
  computePassCount: number;
  computeDispatchCount: number;
  gpuSubmissionCount: number;
  queueWriteMaxBytes: number;
  commandCopyMaxBytes: number;
  pipelineCreationCount: number;
  pipelineBlockingMaxMs: number;
  liveBytes: number;
  peakBytes: number;
  textureBytes: number;
  bufferBytes: number;
  largestResources: readonly ResourceEntry[];
  gpu: DeviceGpuMetrics | null;
};

export type MonitoringSnapshot = {
  fps: {
    live: number;
    target: number;
    refreshHz: number;
    missedFrames: number;
  };
  frame: {
    intervalAverageMs: number;
    intervalP95Ms: number;
    intervalP99Ms: number;
    intervalMaxMs: number;
  };
  physics: {
    rate: number;
    maxSteps: number;
    catchUpSteps: number;
    discardedMs: number;
    remainderMs: number;
  };
  output: {
    width: number;
    height: number;
    pixelRatio: number;
  };
  frameBudgetMs: number;
  sampleRateMs: number;
  sceneTriangles: number;
  grass: GrassMonitoringStats | null;
  shadowPages: ShadowPageStats | null;
  device: DeviceMetrics | null;
};

export type ShadowPageStats = {
  needed: number;
  capacity: number;
  missing: number;
  redrawsPerSecond: number;
  dynamic: number;
  dynamicCapacity: number;
};

export type GrassMonitoringStats = {
  rendered: number;
  renderedPerLod: number[];
  segmentsPerLod: number[];
  total: number;
  renderedTriangles: number;
  allocatedTriangles: number;
};
