export const SHADOW_MODES = ["legacy", "paged"] as const;

export type ShadowMode = (typeof SHADOW_MODES)[number];

const params = new URLSearchParams(window.location.search);
const requestedMode = params.get("shadows");
const visibilityParam = params.get("shadowVisibility");
const requestedVisibility = visibilityParam ? Number(visibilityParam) : 1;
const mode: ShadowMode = requestedMode === "paged" ? "paged" : "legacy";
const initialVisibility = Number.isFinite(requestedVisibility)
  ? Math.min(1, Math.max(0, requestedVisibility))
  : 1;

export const shadowConfig = {
  mode,
  isPagedEnabled: mode === "paged",
  initialVisibility,
};
