import {
  EPSILON,
  Fn,
  clamp,
  float,
  floor,
  max,
  mod,
  pow,
  round,
  sub,
} from "three/tsl";
import type { Node } from "three/webgpu";

type FloatNode = Node<"float">;

type PackArgs = [
  dest: FloatNode,
  offset: FloatNode,
  bits: FloatNode,
  value: FloatNode,
  lsb: FloatNode,
  bias: FloatNode,
];
type UnpackArgs = [
  src: FloatNode,
  offset: FloatNode,
  bits: FloatNode,
  lsb: FloatNode,
  bias: FloatNode,
];
type PackUnitArgs = [
  dest: FloatNode,
  offset: FloatNode,
  bits: FloatNode,
  value: FloatNode,
];
type UnpackUnitArgs = [src: FloatNode, offset: FloatNode, bits: FloatNode];
type PackFlagArgs = [dest: FloatNode, offset: FloatNode, value: FloatNode];
type UnpackFlagArgs = [src: FloatNode, offset: FloatNode];
type PackUnitsArgs = [
  dest: FloatNode,
  offset: FloatNode,
  bits: FloatNode,
  value: FloatNode,
  minV: FloatNode,
  maxV: FloatNode,
];
type UnpackUnitsArgs = [
  src: FloatNode,
  offset: FloatNode,
  bits: FloatNode,
  minV: FloatNode,
  maxV: FloatNode,
];

// fields are fixed point integers stacked in one float, so all fields of a value must fit in 24 bits to stay exact
const pack = Fn<PackArgs, FloatNode>(
  ([dest, offset, bits, value, lsb, bias]) => {
    const levels = sub(pow(2, bits), 1);
    const quantized = clamp(
      round(sub(value, bias).div(max(lsb, EPSILON))),
      0,
      levels,
    );
    const base = pow(2, offset);
    const span = pow(2, bits);
    const previousField = mod(floor(dest.div(base)), span).mul(base);
    return dest.sub(previousField).add(quantized.mul(base));
  },
);

const unpack = Fn<UnpackArgs, FloatNode>(([src, offset, bits, lsb, bias]) => {
  const base = pow(2, offset);
  const span = pow(2, bits);
  const quantized = mod(floor(src.div(base)), span);
  return quantized.mul(lsb).add(bias);
});

export const packUnit = Fn<PackUnitArgs, FloatNode>(
  ([dest, offset, bits, value]) => {
    const lsb = float(1).div(sub(pow(2, bits), 1));
    return pack(dest, offset, bits, value, lsb, float(0));
  },
);

export const unpackUnit = Fn<UnpackUnitArgs, FloatNode>(
  ([src, offset, bits]) => {
    const lsb = float(1).div(sub(pow(2, bits), 1));
    return unpack(src, offset, bits, lsb, float(0));
  },
);

export const packFlag = Fn<PackFlagArgs, FloatNode>(([dest, offset, value]) =>
  pack(dest, offset, float(1), value, float(1), float(0)),
);

export const unpackFlag = Fn<UnpackFlagArgs, FloatNode>(([src, offset]) =>
  unpack(src, offset, float(1), float(1), float(0)),
);

export const packUnits = Fn<PackUnitsArgs, FloatNode>(
  ([dest, offset, bits, value, minV, maxV]) => {
    const lsb = maxV.sub(minV).div(sub(pow(2, bits), 1));
    return pack(dest, offset, bits, value, lsb, minV);
  },
);

export const unpackUnits = Fn<UnpackUnitsArgs, FloatNode>(
  ([src, offset, bits, minV, maxV]) => {
    const lsb = maxV.sub(minV).div(sub(pow(2, bits), 1));
    return unpack(src, offset, bits, lsb, minV);
  },
);
