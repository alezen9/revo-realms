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
  smoothstep,
  step,
  texture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { TSLUtils } from "../../utils/TSLUtils";
import { assetManager } from "../../systems";

export class VegetationSsboUtils {
  /**
   * @param worldPos vec3
   * @param playerPosition vec3
   * @param R0 float
   * @param R1 float
   * @param pMin float
   * @param grassScale float
   * @param bladeHeight float
   * @param cameraMatrix mat4
   * @param fY float
   * @param lowGrassKeep float
   * @param projectedMin float
   * @param projectedFull float
   * @returns `int` Flag keep/discard based on stochastic keep
   */
  static computeStochasticKeep = Fn(
    (
      [
        worldPos = vec3(0),
        playerPosition = vec3(0),
        R0 = float(0),
        R1 = float(0),
        pMin = float(0),
        grassScale = float(1),
        bladeHeight = float(1),
        cameraMatrix = mat4(),
        fY = float(1),
        lowGrassKeep = float(0.55),
        projectedMin = float(0.012),
        projectedFull = float(0.055),
      ],
      _builder,
    ) => {
      // world-space radial thinning (no sqrt)
      const dx = worldPos.x.sub(playerPosition.x);
      const dz = worldPos.z.sub(playerPosition.z);
      const distSq = dx.mul(dx).add(dz.mul(dz));

      const R0Sq = R0.mul(R0);
      const R1Sq = R1.mul(R1);

      // 0 inside R0, 1 at/after R1
      const t = distSq
        .sub(R0Sq)
        .div(max(R1Sq.sub(R0Sq), EPSILON))
        .clamp();

      const pDistance = mix(1, pMin, t);
      const pHeight = mix(lowGrassKeep, 1, grassScale);

      const clip = cameraMatrix.mul(vec4(worldPos, 1.0));
      const eyeDepthAbs = clip.w.abs().max(EPSILON);
      const projectedBladeHeight = fY
        .mul(bladeHeight)
        .mul(grassScale)
        .div(eyeDepthAbs);
      const pScreen = smoothstep(
        projectedMin,
        projectedFull,
        projectedBladeHeight,
      );

      const p = pDistance.mul(pHeight).mul(pScreen);

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
    (
      [
        worldPos = vec3(0),
        cameraMatrix = mat4(),
        fX = float(0),
        fY = float(0),
        r = float(0),
        padNdcX = float(0),
        padNdcYNear = float(0),
        padNdcYFar = float(0),
      ],
      _builder,
    ) => {
      const one = float(1);

      const clip = cameraMatrix.mul(vec4(worldPos, 1.0));
      const invW = one.div(clip.w);
      const ndc = clip.xyz.mul(invW);

      // works for WebGL and WebGPU
      const eyeDepthAbs = clip.w.abs().max(EPSILON); // epsilon only to avoid div-by-zero, not to inflate radius

      const rNdcX = fX.mul(r).div(eyeDepthAbs).add(padNdcX);
      const rNdcY = fY.mul(r).div(eyeDepthAbs);
      const rNdcYNear = rNdcY.add(padNdcYNear);
      const rNdcYFar = rNdcY.sub(padNdcYFar);

      const visLeft = step(one.negate().sub(rNdcX), ndc.x);
      const visRight = step(ndc.x, one.add(rNdcX));
      const visX = visLeft.mul(visRight);

      const visNear = step(one.negate().sub(rNdcYNear), ndc.y);
      const visFar = step(ndc.y.add(rNdcYFar), one);
      const visY = visNear.mul(visFar);

      const visZ = step(-1, ndc.z).mul(step(ndc.z, 1)); // no Z padding

      return visX.mul(visY).mul(visZ);
    },
  );

  /**
   * @param worldPos vec3
   * @returns `float` Grass scale based on grassMap
   */
  static computeGrassScale = Fn(([worldPos = vec3(0)], _builder) => {
    const uv = TSLUtils.computeMapUvByPosition(worldPos.xz);
    const scale = texture(assetManager.resources.grassMap, uv).g;
    return scale;
  });

  static computeGrassMask = Fn(([worldPos = vec3(0)], _builder) => {
    const scale = this.computeGrassScale(worldPos);
    return step(0.25, scale);
  });

  /**
   * @param worldPos vec3
   * @returns `float` Height based on terrain heightmap
   */
  static computeYOffset = Fn(([worldPos = vec3(0)], _builder) => {
    const uv = TSLUtils.computeMapUvByPosition(worldPos.xz);
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
    (
      [posXZ = vec2(0), playerDeltaXZ = vec2(0), tileSize = float(0)],
      _builder,
    ) => {
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
