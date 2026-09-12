import { Fn, cos, float, mix, sin, step, vec2 } from "three/tsl";
import { type Node } from "three/webgpu";
import { assetManager } from "../../../systems";
import { TSLUtils } from "../../../utils/TSLUtils";
import { config, uniforms } from "./config";

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
  return TSLUtils.unpackUnits(data.y, 0, 7, 0, uniforms.uBladeMaxScale);
});

export const setScale = Fn<
  [data: Node<"vec2">, value: Node<"float">],
  Node<"vec2">
>(([data, value]) => {
  data.y = TSLUtils.packUnits(data.y, 0, 7, value, 0, uniforms.uBladeMaxScale);
  return data;
});

export const getOriginalScale = Fn<[data: Node<"vec2">], Node<"float">>(
  ([data]) => {
    return TSLUtils.unpackUnits(
      data.y,
      7,
      7,
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
    7,
    7,
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
    return TSLUtils.unpackFlag(data.y, 14);
  },
);

export const setVisibility = Fn<
  [data: Node<"vec2">, value: Node<"float">],
  Node<"vec2">
>(([data, value]) => {
  data.y = TSLUtils.packFlag(data.y, 14, value);
  return data;
});

export const getPreviousVisibility = Fn<[data: Node<"vec2">], Node<"float">>(
  ([data]) => {
    return TSLUtils.unpackFlag(data.y, 19);
  },
);

export const setPreviousVisibility = Fn<
  [data: Node<"vec2">, value: Node<"float">],
  Node<"vec2">
>(([data, value]) => {
  data.y = TSLUtils.packFlag(data.y, 19, value);
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
  ([data]) => TSLUtils.unpackUnit(data.y, 15, 4),
);

export const setPositionNoise = Fn<
  [data: Node<"vec2">, value: Node<"float">],
  Node<"vec2">
>(([data, value]) => {
  data.y = TSLUtils.packUnit(data.y, 15, 4, value);
  return data;
});

export const getGroundShadowFactor = Fn<
  [data: Node<"vec2">],
  Node<"float">
>(([data]) => TSLUtils.unpackUnit(data.y, 20, 4));

export const setGroundShadowFactor = Fn<
  [data: Node<"vec2">, value: Node<"float">],
  Node<"vec2">
>(([data, value]) => {
  data.y = TSLUtils.packUnit(data.y, 20, 4, value);
  return data;
});

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

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
  const slot = float(bladeSlot);
  const discRadius = slot.add(0.5).div(config.BLADES_PER_CLUMP).sqrt();
  const discAngle = slot.mul(GOLDEN_ANGLE);
  const baseOffset = vec2(cos(discAngle), sin(discAngle)).mul(discRadius);
  const quarterTurnOffset = vec2(baseOffset.y.negate(), baseOffset.x);
  return mix(baseOffset, quarterTurnOffset, clumpRotation.x)
    .mul(clumpRotation.y)
    .mul(config.CLUMP_LOCAL_RADIUS);
});
