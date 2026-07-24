import {
  EPSILON,
  float,
  floor,
  Fn,
  hash,
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
import type { Node } from "three/webgpu";
import { TSLUtils } from "../../utils/TSLUtils";
import { assetManager } from "../../systems";

type StochasticKeepArgs = [
  worldPos: Node<"vec3">,
  playerPosition: Node<"vec3">,
  R0: Node<"float">,
  R1: Node<"float">,
  pMin: Node<"float">,
  bladeHeight: Node<"float">,
  clipPosition: Node<"vec4">,
  fY: Node<"float">,
  projectedMin: Node<"float">,
  projectedFull: Node<"float">,
  spacing: Node<"float">,
  previousKeep: Node<"float">,
  hysteresis: Node<"float">,
];
type ClipPositionArgs = [worldPos: Node<"vec3">, cameraMatrix: Node<"mat4">];
type VisibilityArgs = [
  worldPos: Node<"vec3">,
  cameraMatrix: Node<"mat4">,
  fX: Node<"float">,
  fY: Node<"float">,
  r: Node<"float">,
  padNdcX: Node<"float">,
  padNdcYNear: Node<"float">,
  padNdcYFar: Node<"float">,
];
type VisibilityFromClipArgs = [
  clipPosition: Node<"vec4">,
  fX: Node<"float">,
  fY: Node<"float">,
  r: Node<"float">,
  padNdcX: Node<"float">,
  padNdcYNear: Node<"float">,
  padNdcYFar: Node<"float">,
];
type WrapPositionArgs = [positionXZ: Node<"vec2">, size: Node<"float">];

const GRASS_MAP_CUTOFF = 0.25;

export class VegetationSsboUtils {
  /**
   * @param worldPos vec3
   * @param playerPosition vec3
   * @param R0 float
   * @param R1 float
   * @param pMin float
   * @param bladeHeight float
   * @param clipPosition vec4
   * @param fY float
   * @param projectedMin float
   * @param projectedFull float
   * @param spacing float
   * @param previousKeep float
   * @param hysteresis float
   * @returns `int` Flag keep/discard based on stochastic keep
   */
  static computeStochasticKeep = Fn<StochasticKeepArgs, Node<"float">>(
    ([
      worldPos,
      playerPosition,
      R0,
      R1,
      pMin,
      bladeHeight,
      clipPosition,
      fY,
      projectedMin,
      projectedFull,
      spacing,
      previousKeep,
      hysteresis,
    ]) => {
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

      const eyeDepthAbs = clipPosition.w.abs().max(EPSILON);
      const projectedBladeHeight = fY.mul(bladeHeight).div(eyeDepthAbs);
      const pScreen = smoothstep(
        projectedMin,
        projectedFull,
        projectedBladeHeight,
      );

      const p = pDistance.mul(pScreen);

      const cell = floor(worldPos.xz.div(spacing));
      const rnd = hash(cell.x.mul(12.9898).add(cell.y.mul(78.233)));

      const enterKeep = step(rnd.add(hysteresis), p);
      const stayKeep = step(rnd.sub(hysteresis), p);
      return mix(enterKeep, stayKeep, previousKeep);
    },
  );

  static computeClipPosition = Fn<ClipPositionArgs, Node<"vec4">>(
    ([worldPos, cameraMatrix]) => {
      return cameraMatrix.mul(vec4(worldPos, 1.0));
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
  static computeVisibility = Fn<VisibilityArgs, Node<"float">>(
    ([worldPos, cameraMatrix, fX, fY, r, padNdcX, padNdcYNear, padNdcYFar]) => {
      const clipPosition = this.computeClipPosition(worldPos, cameraMatrix);
      return this.computeVisibilityFromClip(
        clipPosition,
        fX,
        fY,
        r,
        padNdcX,
        padNdcYNear,
        padNdcYFar,
      );
    },
  );

  static computeVisibilityFromClip = Fn<VisibilityFromClipArgs, Node<"float">>(
    ([clipPosition, fX, fY, r, padNdcX, padNdcYNear, padNdcYFar]) => {
      const one = float(1);

      const invW = one.div(clipPosition.w);
      const ndc = clipPosition.xyz.mul(invW);

      // works for WebGL and WebGPU
      const eyeDepthAbs = clipPosition.w.abs().max(EPSILON); // epsilon only to avoid div-by-zero, not to inflate radius

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
  static computeGrassMapValue = Fn<[worldPos: Node<"vec3">], Node<"float">>(
    ([worldPos]) => {
      const uv = TSLUtils.computeMapUvByPosition(worldPos.xz);
      return texture(assetManager.resources.grassMap, uv).g;
    },
  );

  static computeGrassScale = Fn<[worldPos: Node<"vec3">], Node<"float">>(
    ([worldPos]) => {
      const mapValue = this.computeGrassMapValue(worldPos);
      const mask = step(GRASS_MAP_CUTOFF, mapValue);
      const height = mapValue
        .sub(GRASS_MAP_CUTOFF)
        .div(1 - GRASS_MAP_CUTOFF)
        .clamp();

      return height.mul(mask);
    },
  );

  static computeGrassMask = Fn<[worldPos: Node<"vec3">], Node<"float">>(
    ([worldPos]) => {
      const mapValue = this.computeGrassMapValue(worldPos);
      return step(GRASS_MAP_CUTOFF, mapValue);
    },
  );

  /**
   * @param worldPos vec3
   * @returns `float` Height based on terrain heightmap
   */
  static computeYOffset = Fn<[worldPos: Node<"vec3">], Node<"float">>(
    ([worldPos]) => {
      const uv = TSLUtils.computeMapUvByPosition(worldPos.xz);
      const fixedUv = vec2(uv.x, float(1).sub(uv.y));
      const height = texture(assetManager.resources.heightmap, fixedUv).r;
      return height;
    },
  );

  /**
   * @param positionXZ vec2
   * @param size float
   * @returns `vec3` Wrapped position
   */
  static wrapPosition = Fn<WrapPositionArgs, Node<"vec3">>(
    ([positionXZ, size]) => {
      const halfSize = size.div(2);
      const wrappedX = mod(positionXZ.x.add(halfSize), size).sub(halfSize);

      const wrappedZ = mod(positionXZ.y.add(halfSize), size).sub(halfSize);
      return vec3(wrappedX, 0, wrappedZ);
    },
  );
}
