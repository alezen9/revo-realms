import { Color } from "three";

const scratch = new Color();

const toSrgbChannel = (linear: number) =>
  scratch.setScalar(linear).convertLinearToSRGB().r;

const toLinearChannel = (srgb: number) =>
  scratch.setScalar(srgb).convertSRGBToLinear().r;

export const srgbColorTarget = (linearColor: Color) => ({
  value: {
    get r() {
      return toSrgbChannel(linearColor.r);
    },
    set r(value: number) {
      linearColor.r = toLinearChannel(value);
    },
    get g() {
      return toSrgbChannel(linearColor.g);
    },
    set g(value: number) {
      linearColor.g = toLinearChannel(value);
    },
    get b() {
      return toSrgbChannel(linearColor.b);
    },
    set b(value: number) {
      linearColor.b = toLinearChannel(value);
    },
  },
});
