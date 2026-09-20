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
  staticCacheHits: 0,
  staticCacheMisses: 0,
  staticResidentPages: 0,
  staticRenderedPages: 0,
  staticGeneration: 0,
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

export type ResidencyTelemetry = Pick<
  ShadowMonitoringStats,
  | "residentPages"
  | "allocatedPages"
  | "evictedPages"
  | "missingPages"
  | "stalePages"
  | "cacheHits"
  | "cacheMisses"
  | "renderedPages"
> & { generation: number };

export const updateShadowResidencyTelemetry = (
  telemetry: ResidencyTelemetry,
) => {
  stats.residentPages = telemetry.residentPages;
  stats.allocatedPages = telemetry.allocatedPages;
  stats.evictedPages = telemetry.evictedPages;
  stats.missingPages = telemetry.missingPages;
  stats.stalePages = telemetry.stalePages;
  stats.cacheHits = telemetry.cacheHits;
  stats.cacheMisses = telemetry.cacheMisses;
  stats.renderedPages = telemetry.renderedPages;
};

export const updateStaticShadowResidencyTelemetry = (
  telemetry: ResidencyTelemetry,
) => {
  stats.staticCacheHits = telemetry.cacheHits;
  stats.staticCacheMisses = telemetry.cacheMisses;
  stats.staticResidentPages = telemetry.residentPages;
  stats.staticRenderedPages = telemetry.renderedPages;
  stats.staticGeneration = telemetry.generation;
};
