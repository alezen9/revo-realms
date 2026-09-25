const params = new URLSearchParams(window.location.search);

export const isShadowBaseline = params.get("shadows") === "off";
const isDirectSunPreviewRequested = params.get("shadowDebug") === "directSun";
export const isDirectSunMaterialCaptureEnabled =
  isShadowBaseline &&
  (params.get("shadowMrt") === "materials" || isDirectSunPreviewRequested);
export const isDirectSunTargetEnabled =
  isDirectSunMaterialCaptureEnabled ||
  (isShadowBaseline && params.get("shadowMrt") === "true");
export const isDirectSunPreviewEnabled =
  isDirectSunMaterialCaptureEnabled && isDirectSunPreviewRequested;
export const isDirectSunResolveProbeEnabled =
  isDirectSunMaterialCaptureEnabled && params.get("shadowResolve") === "probe";
