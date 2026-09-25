const params = new URLSearchParams(window.location.search);

const shadowMode = params.get("shadows");

export const isShadowBaseline = shadowMode === "off";
export const isPagedV2 = shadowMode === "pagedV2";
const isDirectSunPreviewRequested = params.get("shadowDebug") === "directSun";
export const isDirectSunMaterialCaptureEnabled =
  isPagedV2 ||
  (isShadowBaseline &&
    (params.get("shadowMrt") === "materials" || isDirectSunPreviewRequested));
export const isDirectSunTargetEnabled =
  isDirectSunMaterialCaptureEnabled ||
  (isShadowBaseline && params.get("shadowMrt") === "true");
export const isDirectSunPreviewEnabled =
  isDirectSunMaterialCaptureEnabled && isDirectSunPreviewRequested;
export const isDirectSunResolveEnabled =
  isPagedV2 ||
  (isDirectSunMaterialCaptureEnabled &&
    params.get("shadowResolve") === "probe");
