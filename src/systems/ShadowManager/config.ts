export const SHADOW_MODES = ["legacy", "paged"] as const;

export type ShadowMode = (typeof SHADOW_MODES)[number];

const requestedMode = new URLSearchParams(window.location.search).get("shadows");
const mode: ShadowMode = requestedMode === "paged" ? "paged" : "legacy";

export const shadowConfig = {
  mode,
  isPagedEnabled: mode === "paged",
};
