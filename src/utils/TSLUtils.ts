import {
  Fn,
  vec2,
  float,
  pow,
  floor,
  mod,
  sub,
  clamp,
  max,
  PI2,
  round,
  vec3,
  texture,
  int,
  EPSILON,
  smoothstep,
} from "three/tsl";
import { realmConfig } from "../realm/RevoRealm";
import { assetManager } from "../systems";

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
  private static packF32 = Fn(
    ([
      dest = float(0),
      offset = int(0),
      bits = int(8),
      value = float(0),
      lsb = float(1),
      bias = float(0),
    ], _builder) => {
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
  private static unpackF32 = Fn(
    ([
      src = float(0),
      offset = int(0),
      bits = int(8),
      lsb = float(1),
      bias = float(0),
    ], _builder) => {
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
  static packUnit = Fn(
    ([dest = float(0), offset = int(0), bits = int(8), value = float(0)], _builder) => {
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
  static unpackUnit = Fn(([src = float(0), offset = int(0), bits = int(8)], _builder) => {
    const lsb = float(1).div(sub(pow(2, bits), 1));
    return this.unpackF32(src, offset, bits, lsb, float(0));
  });

  /**
   * @description Packs a binary value that is either 0 or 1
   * @param dest [float] destination data
   * @param offset [int] location of starting bit index
   * @param value [float] flag to be stored, binary 0/1
   */
  static packFlag = Fn(([dest = float(0), offset = int(0), value = float(0)], _builder) =>
    this.packF32(dest, offset, int(1), value, float(1), float(0)),
  );

  /**
   * @description Unpacks a binary value that is either 0 or 1
   * @param src [float] source data
   * @param offset [int] location of starting bit index
   */
  static unpackFlag = Fn(([src = float(0), offset = int(0)], _builder) =>
    this.unpackF32(src, offset, int(1), float(1), float(0)),
  );

  /**
   * @description Packs an angle in radians [0..2π)
   * @param dest [float] destination data
   * @param offset [int] location of starting bit index
   * @param value [float] angle to be stored in radians
   */
  static packAngle = Fn(
    ([dest = float(0), offset = int(0), bits = int(9), value = float(0)], _builder) => {
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
  static unpackAngle = Fn(
    ([src = float(0), offset = int(0), bits = int(9)], _builder) => {
      const lsb = PI2.div(sub(pow(2, bits), 1));
      return this.unpackF32(src, offset, bits, lsb, float(0));
    },
  );

  // Signed range [-A..+A]
  static packSigned = Fn(
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      value = float(0),
      maxAbs = float(1),
    ], _builder) => {
      const levels = sub(pow(2, bits), 1);
      const lsb = maxAbs.mul(2).div(levels); // step
      const bias = maxAbs.negate();
      return this.packF32(packed, offset, bits, value, lsb, bias);
    },
  );
  static unpackSigned = Fn(
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      maxAbs = float(1),
    ], _builder) => {
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
  static packUnits = Fn(
    ([
      dest = float(0),
      offset = int(0),
      bits = int(8),
      value = float(0),
      minV = float(0),
      maxV = float(1),
    ], _builder) => {
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
  static unpackUnits = Fn(
    ([
      src = float(0),
      offset = int(0),
      bits = int(8),
      minV = float(0),
      maxV = float(1),
    ], _builder) => {
      const lsb = maxV.sub(minV).div(sub(pow(2, bits), 1));
      return this.unpackF32(src, offset, bits, lsb, minV);
    },
  );

  static computeMapUvByPosition = Fn(([pos = vec2(0)], _builder) => {
    return pos.add(realmConfig.HALF_MAP_SIZE).div(realmConfig.MAP_SIZE);
  });

  static computeAtlasUv = Fn(
    ([scale = vec2(0), offset = vec2(0), uv = vec2(0)], _builder) => {
      return uv.mul(scale).add(offset);
    },
  );

  static getBakedShadowFactor = Fn(([worldPosXZ = vec2(0)], _builder) => {
    const mapUv = this.computeMapUvByPosition(worldPosXZ);
    const shadow = texture(assetManager.resources.shadowMap, mapUv);
    return shadow.r;
  });

  static getPlayerShadowFactor = Fn(
    ([
      worldPos = vec3(0),
      playerPos = vec3(0),
      playerRadius = float(0.5),
      sunDir = vec3(0),
    ], _builder) => {
      // sunDir points FROM sun TO scene (e.g., normalized(-1,-1,-1))
      // Find where player center projects onto plane at worldPos.y along sunDir
      // playerPos + sunDir * t = shadowPoint, where shadowPoint.y = worldPos.y
      // t = (worldPos.y - playerPos.y) / sunDir.y
      const t = worldPos.y.sub(playerPos.y).div(sunDir.y.add(EPSILON));

      // Shadow center XZ at grass height
      const shadowX = playerPos.x.add(sunDir.x.mul(t));
      const shadowZ = playerPos.z.add(sunDir.z.mul(t));

      // Squared distance from grass to shadow center (XZ plane)
      const dx = worldPos.x.sub(shadowX);
      const dz = worldPos.z.sub(shadowZ);
      const distSq = dx.mul(dx).add(dz.mul(dz));

      // Soft shadow: 0 = full shadow, 1 = lit
      const rSq = playerRadius.mul(playerRadius);
      return smoothstep(rSq.mul(0.5), rSq.mul(2.0), distSq);
    },
  );

  // Inputs n1, n2 are tangent-space normals already unpacked to [-1..1] and normalized.
  // (If you sampled from texture, do: n = tex.rgb * 2 - 1; normalize(n);)
  static blendRNM = Fn(([n1 = vec3(0), n2 = vec3(0)], _builder) => {
    const r = vec3(
      n1.z.mul(n2.x).add(n1.x.mul(n2.z)),
      n1.z.mul(n2.y).add(n1.y.mul(n2.z)),
      n1.z.mul(n2.z).sub(n1.x.mul(n2.x).add(n1.y.mul(n2.y))),
    );
    return r.normalize();
  });

  // partial derivatives, inputs n1, n2 are tangent-space normals already unpacked to [-1..1] and normalized.
  static blendUDN = Fn(([n1 = vec3(0), n2 = vec3(0)], _builder) => {
    return vec3(n1.xy.add(n2.xy), n1.z.mul(n2.z)).normalize();
  });
}
