import type { ShadowMonitoringStats } from "../EventsManager";
import { shadowConfig } from "./config";

const stats: ShadowMonitoringStats = {
  mode: shadowConfig.mode,
  requestedPages: 0,
  requestDensity: 0,
  requestAverageMs: null,
  diagnosticMismatches: 0,
  cacheHits: 0,
  cacheMisses: 0,
  residentPages: 0,
  allocatedPages: 0,
  evictedPages: 0,
  renderedPages: 0,
  missingPages: 0,
  stalePages: 0,
  overflowPages: 0,
};

export const getShadowMonitoringStats = () => ({ ...stats });

export const updateShadowRequestTelemetry = (
  requestedPages: number,
  requestDensity: number,
  overflowPages: number,
  diagnosticMismatches: number,
) => {
  stats.requestedPages = requestedPages;
  stats.requestDensity = requestDensity;
  stats.overflowPages = overflowPages;
  stats.diagnosticMismatches = diagnosticMismatches;
};

type ResidencyTelemetry = Pick<
  ShadowMonitoringStats,
  | "residentPages"
  | "allocatedPages"
  | "evictedPages"
  | "missingPages"
  | "stalePages"
  | "cacheHits"
  | "cacheMisses"
  | "renderedPages"
>;

export const updateShadowResidencyTelemetry = (
  telemetry: ResidencyTelemetry,
) => {
  Object.assign(stats, telemetry);
};
