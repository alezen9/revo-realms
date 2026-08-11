import { Fn, vec2 } from "three/tsl";
import { type Node } from "three/webgpu";
import { assetManager } from "../../../systems";
import { TSLUtils } from "../../../utils/TSLUtils";
import { uniforms } from "./config";

// Bit packing for the per blade buffers, shared by the compute pass and the material.
//
// bladeState   vec4
//   x -> offsetX
//   y -> offsetZ
//   z -> 0/12 bend X - 12/12 bend Z
//   w -> 0/8 scale - 8/8 original scale - 16 terrain cache valid - 17 visibility
//
// bladeTerrain float
//   0/4 position based noise - 4/16 offsetY - 20/4 baked shadow
//
// Every helper is a lazily built Fn, so bodies only run when the graph is
// assembled inside a compute kernel or material, never at import time. That is
// what lets getYOffset read the heightmap bounds after assets have loaded.

const getHeightmapMax = () =>
  Math.ceil(assetManager.resources.heightmap.userData.max);

export const getYOffset = Fn<[data: Node<"float">], Node<"float">>(([data]) => {
  return TSLUtils.unpackUnits(data, 4, 16, 0, getHeightmapMax());
});

export const setYOffset = Fn<
  [data: Node<"float">, value: Node<"float">],
  Node<"float">
>(([data, value]) => {
  return TSLUtils.packUnits(data, 4, 16, value, 0, getHeightmapMax());
});

export const getBend = Fn<[data: Node<"vec4">], Node<"vec2">>(([data]) => {
  const bendX = TSLUtils.unpackUnits(data.z, 0, 12, -6, 6);
  const bendZ = TSLUtils.unpackUnits(data.z, 12, 12, -6, 6);
  return vec2(bendX, bendZ);
});

export const setBend = Fn<
  [data: Node<"vec4">, value: Node<"vec2">],
  Node<"vec4">
>(([data, value]) => {
  data.z = TSLUtils.packUnits(data.z, 0, 12, value.x, -6, 6);
  data.z = TSLUtils.packUnits(data.z, 12, 12, value.y, -6, 6);
  return data;
});

export const getScale = Fn<[data: Node<"vec4">], Node<"float">>(([data]) => {
  return TSLUtils.unpackUnits(data.w, 0, 8, 0, uniforms.uBladeMaxScale);
});

export const setScale = Fn<
  [data: Node<"vec4">, value: Node<"float">],
  Node<"vec4">
>(([data, value]) => {
  data.w = TSLUtils.packUnits(data.w, 0, 8, value, 0, uniforms.uBladeMaxScale);
  return data;
});

export const getOriginalScale = Fn<[data: Node<"vec4">], Node<"float">>(
  ([data]) => {
    return TSLUtils.unpackUnits(
      data.w,
      8,
      8,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
  },
);

export const setOriginalScale = Fn<
  [data: Node<"vec4">, value: Node<"float">],
  Node<"vec4">
>(([data, value]) => {
  data.w = TSLUtils.packUnits(
    data.w,
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
    return TSLUtils.unpackFlag(data.w, 16);
  },
);

export const setTerrainCacheValidity = Fn<
  [data: Node<"vec4">, value: Node<"float">],
  Node<"vec4">
>(([data, value]) => {
  data.w = TSLUtils.packFlag(data.w, 16, value);
  return data;
});

export const getVisibility = Fn<[data: Node<"vec4">], Node<"float">>(
  ([data]) => {
    return TSLUtils.unpackFlag(data.w, 17);
  },
);

export const setVisibility = Fn<
  [data: Node<"vec4">, value: Node<"float">],
  Node<"vec4">
>(([data, value]) => {
  data.w = TSLUtils.packFlag(data.w, 17, value);
  return data;
});

export const getPositionNoise = Fn<[data: Node<"float">], Node<"float">>(
  ([data]) => {
    return TSLUtils.unpackUnit(data, 0, 4);
  },
);

export const setPositionNoise = Fn<
  [data: Node<"float">, value: Node<"float">],
  Node<"float">
>(([data, value]) => {
  return TSLUtils.packUnit(data, 0, 4, value);
});

export const getBakedShadowFactor = Fn<[data: Node<"float">], Node<"float">>(
  ([data]) => {
    return TSLUtils.unpackUnit(data, 20, 4);
  },
);

export const setBakedShadowFactor = Fn<
  [data: Node<"float">, value: Node<"float">],
  Node<"float">
>(([data, value]) => {
  return TSLUtils.packUnit(data, 20, 4, value);
});
