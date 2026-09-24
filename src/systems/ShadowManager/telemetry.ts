import type { ShadowMonitoringStats } from "../EventsManager";
import { shadowConfig } from "./config";

const stats: ShadowMonitoringStats = {
  mode: shadowConfig.mode,
  requestedPages: 0,
  requestedPagesByLevel: [0, 0],
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
  overflowPagesByLevel: [0, 0],
  staticCacheHits: 0,
  staticCacheMisses: 0,
  staticResidentPages: 0,
  staticResidentPagesByLevel: [0, 0],
  staticRenderedPages: 0,
  staticRenderedPagesByLevel: [0, 0],
  staticMissingPagesByLevel: [0, 0],
  staticCasterPageJobs: 0,
  staticCasterDraws: 0,
  staticGeneration: 0,
};

export const getShadowMonitoringStats = () => ({ ...stats });

export const updateShadowRequestTelemetry = (
  requestedPages: number,
  requestDensity: number,
  overflowPages: number,
  diagnosticMismatches: number,
  requestedPagesByLevel: [number, number],
  overflowPagesByLevel: [number, number],
) => {
  stats.requestedPages = requestedPages;
  stats.requestDensity = requestDensity;
  stats.overflowPages = overflowPages;
  stats.diagnosticMismatches = diagnosticMismatches;
  stats.requestedPagesByLevel = requestedPagesByLevel;
  stats.overflowPagesByLevel = overflowPagesByLevel;
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
> & {
  generation: number;
  residentPagesByLevel: [number, number];
  renderedPagesByLevel: [number, number];
  missingPagesByLevel: [number, number];
};

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
  stats.staticResidentPagesByLevel = telemetry.residentPagesByLevel;
  stats.staticRenderedPages = telemetry.renderedPages;
  stats.staticRenderedPagesByLevel = telemetry.renderedPagesByLevel;
  stats.staticMissingPagesByLevel = telemetry.missingPagesByLevel;
  stats.staticGeneration = telemetry.generation;
};

export const updateStaticShadowCasterTelemetry = (
  pageJobs: number,
  drawCount: number,
) => {
  stats.staticCasterPageJobs = pageJobs;
  stats.staticCasterDraws = drawCount;
};
