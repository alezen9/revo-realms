export const SHADOW_MODES = ["legacy", "paged"] as const;
export const SHADOW_DEBUG_VIEWS = [
  "final",
  "mainDepth",
  "pageIds",
  "pageEdges",
  "shadowDepth",
  "range",
] as const;

export type ShadowMode = (typeof SHADOW_MODES)[number];
export type ShadowDebugView = (typeof SHADOW_DEBUG_VIEWS)[number];

const params = new URLSearchParams(window.location.search);
const requestedMode = params.get("shadows");
const visibilityParam = params.get("shadowVisibility");
const debugViewParam = params.get("shadowDebug");
const requestCapacityParam = params.get("shadowRequestCapacity");
const requestStrideParam = params.get("shadowRequestStride");
const requestedVisibility = visibilityParam ? Number(visibilityParam) : 1;
const requestedCapacity = requestCapacityParam
  ? Number(requestCapacityParam)
  : 512;
const requestedStride = requestStrideParam ? Number(requestStrideParam) : 2;
const mode: ShadowMode = requestedMode === "paged" ? "paged" : "legacy";
const initialVisibility = Number.isFinite(requestedVisibility)
  ? Math.min(1, Math.max(0, requestedVisibility))
  : 1;
const initialDebugView: ShadowDebugView =
  SHADOW_DEBUG_VIEWS.find((view) => view === debugViewParam) ?? "final";

export const shadowConfig = {
  mode,
  isPagedEnabled: mode === "paged",
  initialVisibility,
  initialDebugView,
  requestCapacity: Number.isFinite(requestedCapacity)
    ? Math.min(4096, Math.max(1, Math.floor(requestedCapacity)))
    : 512,
  requestStride: requestedStride === 1 ? 1 : 2,
};
