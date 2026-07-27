import {
  Fn,
  float,
  pow,
  floor,
  mod,
  sub,
  clamp,
  max,
  PI2,
  round,
  step,
  vec3,
  EPSILON,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { realmConfig } from "../realm/config";

type FloatNode = Node<"float">;
type Vec2Node = Node<"vec2">;
type Vec3Node = Node<"vec3">;
type Vec4Node = Node<"vec4">;

type PackF32Args = [
  dest: FloatNode,
  offset: FloatNode,
  bits: FloatNode,
  value: FloatNode,
  lsb: FloatNode,
  bias: FloatNode,
];
type UnpackF32Args = [
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
type PackSignedArgs = [
  packed: FloatNode,
  offset: FloatNode,
  bits: FloatNode,
  value: FloatNode,
  maxAbs: FloatNode,
];
type UnpackSignedArgs = [
  packed: FloatNode,
  offset: FloatNode,
  bits: FloatNode,
  maxAbs: FloatNode,
];
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
type AtlasUvArgs = [scale: Vec2Node, offset: Vec2Node, uv: Vec2Node];
type BlendNormalsArgs = [n1: Vec3Node, n2: Vec3Node];
type FrustumVisibilityArgs = [
  clipPosition: Vec4Node,
  fX: FloatNode,
  fY: FloatNode,
  radius: FloatNode,
  padNdcX: FloatNode,
  padNdcYNear: FloatNode,
  padNdcYFar: FloatNode,
];

export class TSLUtils {
  /**
   * @description Packs into [offset, bits] using fixed-point (lsb, bias)
   * @param dest [float] destination data
   * @param offset [int] location of starting bit index
   * @param bits [int] how many bits it should occupy
   * @param value [float] value to be stored
   * @param lsb [float]
   * @param bias [float]
   */
  private static packF32 = Fn<PackF32Args, FloatNode>(
    ([dest, offset, bits, value, lsb, bias]) => {
      const levels = sub(pow(2, bits), 1);
      const qRaw = sub(value, bias).div(max(lsb, EPSILON));
      const q = clamp(round(qRaw), 0, levels);

      const base = pow(2, offset); // 2^offset
      const span = pow(2, bits); // 2^bits
      const slot = floor(dest.div(base));
      const old = mod(slot, span).mul(base); // old field value * base

      // remove old field, add new field
      return dest.sub(old).add(q.mul(base));
    },
  );

  /**
   * @description Unpacks from [offset, bits] with (lsb, bias)
   * @param src [float] source data
   * @param offset [int] location of starting bit index
   * @param bits [int] how many bits it occupies
   * @param lsb [float]
   * @param bias [float]
   */
  private static unpackF32 = Fn<UnpackF32Args, FloatNode>(
    ([src, offset, bits, lsb, bias]) => {
      const base = pow(2, offset);
      const span = pow(2, bits);
      const slot = floor(src.div(base));
      const q = mod(slot, span);
      return q.mul(lsb).add(bias);
    },
  );

  /**
   * @description Packs a value with a range 0..1
   * @param dest [float] destination data
   * @param offset [int] location of starting bit index
   * @param bits [int] how many bits it should occupy
   * @param value [float] value to be stored (in range 0..1)
   */
  static packUnit = Fn<PackUnitArgs, FloatNode>(
    ([dest, offset, bits, value]) => {
      const lsb = float(1).div(sub(pow(2, bits), 1)); // 1/(2^bits-1)
      return this.packF32(dest, offset, bits, value, lsb, float(0));
    },
  );

  /**
   * @description Unpacks a value with a range 0..1
   * @param src [float] source data
   * @param offset [int] location of starting bit index
   * @param bits [int] how many bits it occupies
   */
  static unpackUnit = Fn<UnpackUnitArgs, FloatNode>(([src, offset, bits]) => {
    const lsb = float(1).div(sub(pow(2, bits), 1));
    return this.unpackF32(src, offset, bits, lsb, float(0));
  });

  /**
   * @description Packs a binary value that is either 0 or 1
   * @param dest [float] destination data
   * @param offset [int] location of starting bit index
   * @param value [float] flag to be stored, binary 0/1
   */
  static packFlag = Fn<PackFlagArgs, FloatNode>(([dest, offset, value]) =>
    this.packF32(dest, offset, float(1), value, float(1), float(0)),
  );

  /**
   * @description Unpacks a binary value that is either 0 or 1
   * @param src [float] source data
   * @param offset [int] location of starting bit index
   */
  static unpackFlag = Fn<UnpackFlagArgs, FloatNode>(([src, offset]) =>
    this.unpackF32(src, offset, float(1), float(1), float(0)),
  );

  /**
   * @description Packs an angle in radians [0..2π)
   * @param dest [float] destination data
   * @param offset [int] location of starting bit index
   * @param value [float] angle to be stored in radians
   */
  static packAngle = Fn<PackUnitArgs, FloatNode>(
    ([dest, offset, bits, value]) => {
      const levels = sub(pow(2, bits), 1);
      const lsb = PI2.div(levels); // 2π/(2^bits-1)
      // wrap into [0,2π)
      const a = value.sub(PI2.mul(floor(value.div(PI2))));
      return this.packF32(dest, offset, bits, a, lsb, float(0));
    },
  );

  /**
   * @description Unpacks an angle in radians [0..2π)
   * @param src [float] source data
   * @param offset [int] location of starting bit index
   * @param bits [int] how many bits it occupies
   */
  static unpackAngle = Fn<UnpackUnitArgs, FloatNode>(([src, offset, bits]) => {
    const lsb = PI2.div(sub(pow(2, bits), 1));
    return this.unpackF32(src, offset, bits, lsb, float(0));
  });

  // Signed range [-A..+A]
  static packSigned = Fn<PackSignedArgs, FloatNode>(
    ([packed, offset, bits, value, maxAbs]) => {
      const levels = sub(pow(2, bits), 1);
      const lsb = maxAbs.mul(2).div(levels); // step
      const bias = maxAbs.negate();
      return this.packF32(packed, offset, bits, value, lsb, bias);
    },
  );
  static unpackSigned = Fn<UnpackSignedArgs, FloatNode>(
    ([packed, offset, bits, maxAbs]) => {
      const lsb = maxAbs.mul(2).div(sub(pow(2, bits), 1));
      const bias = maxAbs.negate();
      return this.unpackF32(packed, offset, bits, lsb, bias);
    },
  );

  /**
   * @description Packs a value with a range min..max both ends included
   * @param dest [float] destination data
   * @param offset [int] location of starting bit index
   * @param bits [int] how many bits it should occupy
   * @param value [float] value to be stored (in range 0..1)
   * @param minV [float] min (included)
   * @param maxV [float] max (included)
   */
  static packUnits = Fn<PackUnitsArgs, FloatNode>(
    ([dest, offset, bits, value, minV, maxV]) => {
      const levels = sub(pow(2, bits), 1);
      const lsb = maxV.sub(minV).div(levels);
      return this.packF32(dest, offset, bits, value, lsb, minV);
    },
  );

  /**
   * @description Unpacks a value with a range min..max both ends included
   * @param src [float] source data
   * @param offset [int] location of starting bit index
   * @param bits [int] how many bits it occupies
   * @param minV [float] min (included)
   * @param maxV [float] max (included)
   */
  static unpackUnits = Fn<UnpackUnitsArgs, FloatNode>(
    ([src, offset, bits, minV, maxV]) => {
      const lsb = maxV.sub(minV).div(sub(pow(2, bits), 1));
      return this.unpackF32(src, offset, bits, lsb, minV);
    },
  );

  static computeMapUvByPosition = Fn<[pos: Vec2Node], Vec2Node>(([pos]) => {
    return pos.add(realmConfig.HALF_MAP_SIZE).div(realmConfig.MAP_SIZE);
  });

  static computeFrustumVisibility = Fn<FrustumVisibilityArgs, FloatNode>(
    ([clipPosition, fX, fY, radius, padNdcX, padNdcYNear, padNdcYFar]) => {
      const one = float(1);
      const ndc = clipPosition.xyz.mul(one.div(clipPosition.w));
      const eyeDepthAbs = clipPosition.w.abs().max(EPSILON);
      const radiusNdcX = fX.mul(radius).div(eyeDepthAbs).add(padNdcX);
      const radiusNdcY = fY.mul(radius).div(eyeDepthAbs);
      const radiusNdcYNear = radiusNdcY.add(padNdcYNear);
      const radiusNdcYFar = radiusNdcY.sub(padNdcYFar);
      const isVisibleX = step(one.negate().sub(radiusNdcX), ndc.x).mul(
        step(ndc.x, one.add(radiusNdcX)),
      );
      const isVisibleY = step(one.negate().sub(radiusNdcYNear), ndc.y).mul(
        step(ndc.y.add(radiusNdcYFar), one),
      );
      const isVisibleZ = step(-1, ndc.z).mul(step(ndc.z, 1));
      return isVisibleX.mul(isVisibleY).mul(isVisibleZ);
    },
  );

  static computeAtlasUv = Fn<AtlasUvArgs, Vec2Node>(([scale, offset, uv]) => {
    return uv.mul(scale).add(offset);
  });

  // Inputs n1, n2 are tangent-space normals already unpacked to [-1..1] and normalized.
  // (If you sampled from texture, do: n = tex.rgb * 2 - 1; normalize(n);)
  static blendRNM = Fn<BlendNormalsArgs, Vec3Node>(([n1, n2]) => {
    const r = vec3(
      n1.z.mul(n2.x).add(n1.x.mul(n2.z)),
      n1.z.mul(n2.y).add(n1.y.mul(n2.z)),
      n1.z.mul(n2.z).sub(n1.x.mul(n2.x).add(n1.y.mul(n2.y))),
    );
    return r.normalize();
  });

  // partial derivatives, inputs n1, n2 are tangent-space normals already unpacked to [-1..1] and normalized.
  static blendUDN = Fn<BlendNormalsArgs, Vec3Node>(([n1, n2]) => {
    return vec3(n1.xy.add(n2.xy), n1.z.mul(n2.z)).normalize();
  });
}
