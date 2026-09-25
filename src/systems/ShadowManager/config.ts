const shadowMode = new URLSearchParams(window.location.search).get("shadows");

export const isShadowBaseline = shadowMode === "off";
export const isPagedV2 = shadowMode === "pagedV2";
export const isDirectSunMaterialCaptureEnabled = isPagedV2;
