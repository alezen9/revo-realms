import { Fn, array, float, mix, step, vec2 } from "three/tsl";
import { type Node } from "three/webgpu";
import { assetManager } from "../../../systems";
import { TSLUtils } from "../../../utils/TSLUtils";
import { config, uniforms } from "./config";

// Bit packing for the per blade buffers, shared by the compute pass and the material.
//
// clumpState vec4
//   x, y -> wrapped center XZ
//   z -> cached grass scale
//   w -> 0/16 offsetY - 16/4 baked shadow - 20 terrain cache valid - 21/2 orientation
// bits 0..22 cap the packed integer at 2^23 - 1, exactly representable in f32
//
// bladeState vec2
//   x -> 0/12 bend X - 12/12 bend Z
//   y -> 0/8 scale - 8/8 original scale - 16 previous visibility - 17/4 position noise
//
// Every helper is a lazily built Fn, so bodies only run when the graph is
// assembled inside a compute kernel or material, never at import time. That is
// what lets getYOffset read the heightmap bounds after assets have loaded.

const getHeightmapMax = () =>
  Math.ceil(assetManager.resources.heightmap.userData.max);

export const getYOffset = Fn<[data: Node<"vec4">], Node<"float">>(([data]) => {
  return TSLUtils.unpackUnits(data.w, 0, 16, 0, getHeightmapMax());
});

export const setYOffset = Fn<
  [data: Node<"vec4">, value: Node<"float">],
  Node<"vec4">
>(([data, value]) => {
  data.w = TSLUtils.packUnits(data.w, 0, 16, value, 0, getHeightmapMax());
  return data;
});

export const getBend = Fn<[data: Node<"vec2">], Node<"vec2">>(([data]) => {
  const bendX = TSLUtils.unpackUnits(data.x, 0, 12, -6, 6);
  const bendZ = TSLUtils.unpackUnits(data.x, 12, 12, -6, 6);
  return vec2(bendX, bendZ);
});

export const setBend = Fn<
  [data: Node<"vec2">, value: Node<"vec2">],
  Node<"vec2">
>(([data, value]) => {
  data.x = TSLUtils.packUnits(data.x, 0, 12, value.x, -6, 6);
  data.x = TSLUtils.packUnits(data.x, 12, 12, value.y, -6, 6);
  return data;
});

export const getScale = Fn<[data: Node<"vec2">], Node<"float">>(([data]) => {
  return TSLUtils.unpackUnits(data.y, 0, 8, 0, uniforms.uBladeMaxScale);
});

export const setScale = Fn<
  [data: Node<"vec2">, value: Node<"float">],
  Node<"vec2">
>(([data, value]) => {
  data.y = TSLUtils.packUnits(data.y, 0, 8, value, 0, uniforms.uBladeMaxScale);
  return data;
});

export const getOriginalScale = Fn<[data: Node<"vec2">], Node<"float">>(
  ([data]) => {
    return TSLUtils.unpackUnits(
      data.y,
      8,
      8,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
  },
);

export const setOriginalScale = Fn<
  [data: Node<"vec2">, value: Node<"float">],
  Node<"vec2">
>(([data, value]) => {
  data.y = TSLUtils.packUnits(
    data.y,
    8,
    8,
    value,
    uniforms.uBladeMinScale,
    uniforms.uBladeMaxScale,
  );
  return data;
});

export const getTerrainCacheValidity = Fn<[data: Node<"vec4">], Node<"float">>(
  ([data]) => {
    return TSLUtils.unpackFlag(data.w, 20);
  },
);

export const setTerrainCacheValidity = Fn<
  [data: Node<"vec4">, value: Node<"float">],
  Node<"vec4">
>(([data, value]) => {
  data.w = TSLUtils.packFlag(data.w, 20, value);
  return data;
});

export const getVisibility = Fn<[data: Node<"vec2">], Node<"float">>(
  ([data]) => {
    return TSLUtils.unpackFlag(data.y, 16);
  },
);

export const setVisibility = Fn<
  [data: Node<"vec2">, value: Node<"float">],
  Node<"vec2">
>(([data, value]) => {
  data.y = TSLUtils.packFlag(data.y, 16, value);
  return data;
});

export const getBakedShadowFactor = Fn<[data: Node<"vec4">], Node<"float">>(
  ([data]) => {
    return TSLUtils.unpackUnit(data.w, 16, 4);
  },
);

export const setBakedShadowFactor = Fn<
  [data: Node<"vec4">, value: Node<"float">],
  Node<"vec4">
>(([data, value]) => {
  data.w = TSLUtils.packUnit(data.w, 16, 4, value);
  return data;
});

export const setClumpOrientation = Fn<
  [data: Node<"vec4">, value: Node<"float">],
  Node<"vec4">
>(([data, value]) => {
  data.w = TSLUtils.packUnits(data.w, 21, 2, value, 0, 3);
  return data;
});

export const getPositionNoise = Fn<[data: Node<"vec2">], Node<"float">>(
  ([data]) => TSLUtils.unpackUnit(data.y, 17, 4),
);

export const setPositionNoise = Fn<
  [data: Node<"vec2">, value: Node<"float">],
  Node<"vec2">
>(([data, value]) => {
  data.y = TSLUtils.packUnit(data.y, 17, 4, value);
  return data;
});

const BLADE_LOCAL_OFFSETS = array([
  vec2(0.316227766017, 0),
  vec2(-0.403873567726, 0.369981271543),
  vec2(0.061819322798, -0.704399298217),
  vec2(0.509056473571, 0.663974025633),
  vec2(-0.934181236884, -0.165243507147),
]);

export const getClumpRotation = Fn<[data: Node<"vec4">], Node<"vec2">>(
  ([data]) => {
    const orientation = TSLUtils.unpackUnits(data.w, 21, 2, 0, 3);
    const isQuarterTurn = float(orientation.mod(2));
    const direction = float(1).sub(step(2, orientation).mul(2));
    return vec2(isQuarterTurn, direction);
  },
);

export const getBladeLocalOffset = Fn<
  [bladeSlot: Node<"uint">, clumpRotation: Node<"vec2">],
  Node<"vec2">
>(([bladeSlot, clumpRotation]) => {
  const baseOffset = BLADE_LOCAL_OFFSETS.element(bladeSlot);
  const quarterTurnOffset = vec2(baseOffset.y.negate(), baseOffset.x);
  return mix(baseOffset, quarterTurnOffset, clumpRotation.x)
    .mul(clumpRotation.y)
    .mul(config.CLUMP_LOCAL_RADIUS);
});
