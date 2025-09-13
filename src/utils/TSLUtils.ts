import {
  Fn,
  vec2,
  float,
  pow,
  floor,
  mod,
  add,
  sub,
  clamp,
  max,
  PI2,
  round,
} from "three/tsl";
import { realmConfig } from "../realms/PortfolioRealm";

class TSLUtils {
  private pow2 = Fn(([n = float(0)]) => pow(float(2.0), n));

  /** pack into [offset, bits] using fixed-point (lsb, bias) */
  packF32 = Fn(
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      value = float(0),
      lsb = float(1),
      bias = float(0),
    ]) => {
      const levels = sub(this.pow2(bits), 1.0);
      const qRaw = sub(value, bias).div(max(lsb, 1e-20));
      const q = clamp(round(qRaw), 0.0, levels);

      const base = this.pow2(offset); // 2^offset
      const span = this.pow2(bits); // 2^bits
      const slot = floor(packed.div(base));
      const old = mod(slot, span).mul(base); // old field value * base

      // remove old field, add new field
      return packed.sub(old).add(q.mul(base));
    },
  );

  /** unpack from [offset, bits] with (lsb, bias) */
  unpackF32 = Fn(
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      lsb = float(1),
      bias = float(0),
    ]) => {
      const base = this.pow2(offset);
      const span = this.pow2(bits);
      const slot = floor(packed.div(base));
      const q = mod(slot, span);
      return q.mul(lsb).add(bias);
    },
  );

  // [0..1] unit value
  packUnit = Fn(
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      x01 = float(0),
    ]) => {
      const lsb = float(1).div(sub(this.pow2(bits), 1.0)); // 1/(2^bits-1)
      return this.packF32(packed, offset, bits, x01, lsb, float(0));
    },
  );
  unpackUnit = Fn(([packed = float(0), offset = float(0), bits = float(8)]) => {
    const lsb = float(1).div(sub(this.pow2(bits), 1.0));
    return this.unpackF32(packed, offset, bits, lsb, float(0));
  });

  // Boolean/flag (single bit 0/1) – uses packUnit with bits=1
  packFlag = Fn(([packed = float(0), offset = float(0), flag01 = float(0)]) =>
    this.packF32(packed, offset, float(1), flag01, float(1), float(0)),
  );
  unpackFlag = Fn(([packed = float(0), offset = float(0)]) =>
    this.unpackF32(packed, offset, float(1), float(1), float(0)),
  );

  // Angle in radians [0..2π)
  packAngle = Fn(
    ([
      packed = float(0),
      offset = float(0),
      bits = float(9),
      angle = float(0),
    ]) => {
      const levels = sub(this.pow2(bits), 1.0);
      const lsb = PI2.div(levels); // 2π/(2^bits-1)
      // wrap into [0,2π)
      const a = angle.sub(PI2.mul(floor(angle.div(PI2))));
      return this.packF32(packed, offset, bits, a, lsb, float(0));
    },
  );
  unpackAngle = Fn(
    ([packed = float(0), offset = float(0), bits = float(9)]) => {
      const lsb = PI2.div(sub(this.pow2(bits), 1.0));
      return this.unpackF32(packed, offset, bits, lsb, float(0));
    },
  );

  // Signed range [-A..+A]
  packSigned = Fn(
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      value = float(0),
      maxAbs = float(1),
    ]) => {
      const levels = sub(this.pow2(bits), 1.0);
      const lsb = maxAbs.mul(2.0).div(levels); // step
      const bias = maxAbs.negate();
      return this.packF32(packed, offset, bits, value, lsb, bias);
    },
  );
  unpackSigned = Fn(
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      maxAbs = float(1),
    ]) => {
      const lsb = maxAbs.mul(2.0).div(sub(this.pow2(bits), 1.0));
      const bias = maxAbs.negate();
      return this.unpackF32(packed, offset, bits, lsb, bias);
    },
  );

  // Generic units [min..max] (inclusive)
  packUnits = Fn(
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      value = float(0),
      minV = float(0),
      maxV = float(1),
    ]) => {
      const levels = sub(this.pow2(bits), 1.0);
      const lsb = maxV.sub(minV).div(levels);
      return this.packF32(packed, offset, bits, value, lsb, minV);
    },
  );
  unpackUnits = Fn(
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      minV = float(0),
      maxV = float(1),
    ]) => {
      const lsb = maxV.sub(minV).div(sub(this.pow2(bits), 1.0));
      return this.unpackF32(packed, offset, bits, lsb, minV);
    },
  );

  computeMapUvByPosition = Fn(([pos = vec2(0)]) => {
    return pos.add(realmConfig.HALF_MAP_SIZE).div(realmConfig.MAP_SIZE);
  });
  computeAtlasUv = Fn(([scale = vec2(0), offset = vec2(0), uv = vec2(0)]) => {
    return uv.mul(scale).add(offset);
  });
}

export const tslUtils = new TSLUtils();
