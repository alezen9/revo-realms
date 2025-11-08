import {
  EPSILON,
  float,
  Fn,
  hash,
  instanceIndex,
  mat4,
  max,
  mix,
  mod,
  step,
  texture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { tslUtils } from "../../utils/TSLUtils";
import { assetManager } from "../../systems";

export class VegetationSsboUtils {
  /**
   * @param worldPos vec3
   * @param playerPosition vec3
   * @param R0 float
   * @param R1 float
   * @param pMin float
   * @returns `int` Flag keep/discard based on stochastic keep
   */
  static computeStochasticKeep = Fn(
    ([
      worldPos = vec3(0),
      playerPosition = vec3(0),
      R0 = float(0),
      R1 = float(0),
      pMin = float(0),
    ]) => {
      // world-space radial thinning (no sqrt)
      const dx = worldPos.x.sub(playerPosition.x);
      const dz = worldPos.z.sub(playerPosition.z);
      const distSq = dx.mul(dx).add(dz.mul(dz));

      const R0Sq = R0.mul(R0),
        R1Sq = R1.mul(R1);

      // 0 inside R0, 1 at/after R1
      const t = distSq
        .sub(R0Sq)
        .div(max(R1Sq.sub(R0Sq), 1e-5))
        .clamp();

      // keep probability from 1 → pMin
      const p = mix(1, pMin, t);

      // deterministic RNG per blade (stable under wrap)
      const rnd = hash(float(instanceIndex).mul(0.73));

      const keep = step(rnd, p);
      return keep;
    },
  );

  /**
   * @param worldPos vec3
   * @param cameraMatrix mat4
   * @param fX float
   * @param fY float
   * @param r float
   * @param padNdcX float (affects both left and right)
   * @param padNdcY float (affects only near)
   * @returns `int` Flag inside/outside camera frustum
   */
  static computeVisibility = Fn(
    ([
      worldPos = vec3(0),
      cameraMatrix = mat4(0),
      fX = float(0),
      fY = float(0),
      r = float(0),
      padNdcX = float(0),
      padNdcY = float(0),
    ]) => {
      const clip = cameraMatrix.mul(vec4(worldPos, 1.0));
      const invW = float(1).div(clip.w);
      const ndc = clip.xyz.mul(invW);

      // works for WebGL and WebGPU
      const eyeDepthAbs = clip.w.abs().max(EPSILON); // epsilon only to avoid div-by-zero, not to inflate radius

      const rNdcX = fX.mul(r).div(eyeDepthAbs).add(padNdcX);
      const rNdcY = fY.mul(r).div(eyeDepthAbs).add(padNdcY);

      const one = float(1);

      const visLeft = step(one.negate().sub(rNdcX), ndc.x);
      const visRight = step(ndc.x, one.add(rNdcX));
      const visX = visLeft.mul(visRight);

      const visNear = step(one.negate().sub(rNdcY), ndc.y);
      const visFar = step(ndc.y, one);
      const visY = visNear.mul(visFar);

      const visZ = step(-1, ndc.z).mul(step(ndc.z, 1)); // no Z padding

      return visX.mul(visY).mul(visZ);
    },
  );

  /**
   * @param worldPos vec3
   * @returns `float` Alpha based on grassMap
   */
  static computeAlpha = Fn(([worldPos = vec3(0)]) => {
    const uv = tslUtils.computeMapUvByPosition(worldPos.xz);
    const alpha = texture(assetManager.resources.grassMap, uv).g;
    const threshold = step(0.25, alpha);
    return threshold;
  });

  /**
   * @param worldPos vec3
   * @returns `float` Height based on terrain heightmap
   */
  static computeYOffset = Fn(([worldPos = vec3(0)]) => {
    const uv = tslUtils.computeMapUvByPosition(worldPos.xz);
    const fixedUv = vec2(uv.x, float(1).sub(uv.y));
    const height = texture(assetManager.resources.heightmap, fixedUv).r;
    return height;
  });

  /**
   * @param posXZ vec2
   * @param playerDeltaXZ vec2
   * @param tileSize float
   * @returns `vec3` Wrapped position
   */
  static wrapPosition = Fn(
    ([posXZ = vec2(0), playerDeltaXZ = vec2(0), tileSize = float(0)]) => {
      const halfTile = tileSize.div(2);
      const newOffsetX = mod(
        posXZ.x.sub(playerDeltaXZ.x).add(halfTile),
        tileSize,
      ).sub(halfTile);

      const newOffsetZ = mod(
        posXZ.y.sub(playerDeltaXZ.y).add(halfTile),
        tileSize,
      ).sub(halfTile);
      return vec3(newOffsetX, 0, newOffsetZ);
    },
  );
}
