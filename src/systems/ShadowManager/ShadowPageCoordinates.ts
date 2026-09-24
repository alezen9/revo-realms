import { MathUtils, Vector3 } from "three";
import type { Texture } from "three";
import type { Node } from "three/webgpu";
import { float, uint, uniform, vec2, vec3 } from "three/tsl";

export const SHADOW_PAGE_GRID_SIZE = 128;
export const SHADOW_MINIMUM_PAGE_COORDINATE = -SHADOW_PAGE_GRID_SIZE / 2;
export const SHADOW_PAGES_PER_LEVEL = SHADOW_PAGE_GRID_SIZE ** 2;
export const SHADOW_PAGE_LEVEL_COUNT = 2;
export const SHADOW_VIRTUAL_PAGE_COUNT =
  SHADOW_PAGES_PER_LEVEL * SHADOW_PAGE_LEVEL_COUNT;

export const encodeShadowPageKey = (
  level: number,
  pageX: number,
  pageY: number,
) =>
  level * SHADOW_PAGES_PER_LEVEL +
  (pageY - SHADOW_MINIMUM_PAGE_COORDINATE) * SHADOW_PAGE_GRID_SIZE +
  pageX -
  SHADOW_MINIMUM_PAGE_COORDINATE;

export const decodeShadowPageKey = (pageKey: number) => {
  const level = Math.floor(pageKey / SHADOW_PAGES_PER_LEVEL);
  const localKey = pageKey % SHADOW_PAGES_PER_LEVEL;
  const pageX =
    (localKey % SHADOW_PAGE_GRID_SIZE) + SHADOW_MINIMUM_PAGE_COORDINATE;
  const pageY =
    Math.floor(localKey / SHADOW_PAGE_GRID_SIZE) +
    SHADOW_MINIMUM_PAGE_COORDINATE;
  return { level, pageX, pageY };
};

export const decodeGpuShadowPageKey = (pageKey: Node<"uint">) => {
  const level = pageKey.div(SHADOW_PAGES_PER_LEVEL);
  const localKey = pageKey.mod(SHADOW_PAGES_PER_LEVEL);
  const localPageX = localKey.mod(SHADOW_PAGE_GRID_SIZE);
  const localPageY = localKey.div(SHADOW_PAGE_GRID_SIZE);
  const pageId = vec2(float(localPageX), float(localPageY)).add(
    SHADOW_MINIMUM_PAGE_COORDINATE,
  );
  return { level, localPageX, localPageY, pageId };
};

export const getGpuShadowPageWorldSize = (level: Node<"uint">) =>
  level
    .equal(uint(0))
    .select(
      float(shadowPageCoordinateConfig.pageWorldSize),
      float(shadowPageCoordinateConfig.pageWorldSize * 2),
    );

export const encodeGpuShadowPageKey = (
  level: Node<"uint">,
  pageId: Node<"vec2">,
) =>
  level.mul(SHADOW_PAGES_PER_LEVEL).add(
    uint(pageId.y.sub(SHADOW_MINIMUM_PAGE_COORDINATE))
      .mul(SHADOW_PAGE_GRID_SIZE)
      .add(uint(pageId.x.sub(SHADOW_MINIMUM_PAGE_COORDINATE))),
  );

export const shadowPageCoordinateConfig = Object.freeze({
  pageWorldSize: 32,
  transitionStart: 96,
  transitionEnd: 128,
  minimumSunElevationDegrees: 15,
  maximumSunElevationDegrees: 85,
  terrainBelowPadding: 8,
  casterAboveTerrain: 64,
});

const minimumSunY = Math.sin(
  MathUtils.degToRad(shadowPageCoordinateConfig.minimumSunElevationDegrees),
);
const maximumSunY = Math.sin(
  MathUtils.degToRad(shadowPageCoordinateConfig.maximumSunElevationDegrees),
);

export type ShadowPageAddress = {
  pageX: number;
  pageY: number;
  pageU: number;
  pageV: number;
  normalizedDepth: number;
  isOutOfRange: boolean;
};

type GpuPageAddressArgs = {
  worldPosition: Node<"vec3">;
  sunDirection: Node<"vec3">;
  minimumWorldY: Node<"float">;
  maximumWorldY: Node<"float">;
  level?: Node<"uint">;
};

export const computeGpuShadowPageAddress = (args: GpuPageAddressArgs) => {
  const { worldPosition, sunDirection, minimumWorldY, maximumWorldY, level } =
    args;
  const absoluteSunY = sunDirection.y.abs().max(0.0001);
  const horizontalSunLength = sunDirection.xz.length().max(0.0001);
  const lightXAxis = vec3(sunDirection.z, 0, sunDirection.x.negate()).div(
    horizontalSunLength,
  );
  const lightYAxis = sunDirection.cross(lightXAxis).normalize();
  const lightPosition = vec2(
    worldPosition.dot(lightXAxis),
    worldPosition.dot(lightYAxis),
  );
  const pageWorldSize = getGpuShadowPageWorldSize(level ?? uint(0));
  const pagePosition = lightPosition.div(pageWorldSize);
  const pageId = pagePosition.floor();
  const pageUv = pagePosition.fract();

  const relativeDepth = worldPosition.y.negate().div(absoluteSunY);
  const minimumDepth = maximumWorldY.negate().div(absoluteSunY);
  const maximumDepth = minimumWorldY.negate().div(absoluteSunY);
  const normalizedDepth = relativeDepth
    .sub(minimumDepth)
    .div(maximumDepth.sub(minimumDepth));
  const isOutOfRange = worldPosition.y
    .lessThan(minimumWorldY)
    .or(worldPosition.y.greaterThan(maximumWorldY))
    .or(absoluteSunY.lessThan(minimumSunY))
    .or(absoluteSunY.greaterThan(maximumSunY));

  return {
    pageId,
    pageUv,
    normalizedDepth,
    isOutOfRange,
  };
};

export class ShadowPageCoordinates {
  readonly minimumWorldY = uniform(-8);
  readonly maximumWorldY = uniform(64);

  private terrainMinimumY = 0;
  private terrainMaximumY = 0;
  private registeredCasterMinimumY = Number.POSITIVE_INFINITY;
  private registeredCasterMaximumY = Number.NEGATIVE_INFINITY;
  private lightXAxis = new Vector3();
  private lightYAxis = new Vector3();

  syncTerrainBounds(heightmap: Texture) {
    const { min, max } = heightmap.userData;
    if (typeof min !== "number" || typeof max !== "number") return false;
    if (min === this.terrainMinimumY && max === this.terrainMaximumY)
      return false;

    this.terrainMinimumY = min;
    this.terrainMaximumY = max;
    this.syncVerticalBounds();
    return true;
  }

  registerCasterVerticalBounds(minimumY: number, maximumY: number) {
    this.registeredCasterMinimumY = Math.min(
      this.registeredCasterMinimumY,
      minimumY,
    );
    this.registeredCasterMaximumY = Math.max(
      this.registeredCasterMaximumY,
      maximumY,
    );
    this.syncVerticalBounds();
  }

  computeAddress(worldPosition: Vector3, sunDirection: Vector3, level = 0) {
    const absoluteSunY = Math.max(Math.abs(sunDirection.y), 0.0001);
    this.lightXAxis.set(sunDirection.z, 0, -sunDirection.x).normalize();
    this.lightYAxis.crossVectors(sunDirection, this.lightXAxis).normalize();

    const lightX = worldPosition.dot(this.lightXAxis);
    const lightY = worldPosition.dot(this.lightYAxis);
    const pageWorldSize =
      shadowPageCoordinateConfig.pageWorldSize * (level + 1);
    const pageX = Math.floor(lightX / pageWorldSize);
    const pageY = Math.floor(lightY / pageWorldSize);
    const pageU = MathUtils.euclideanModulo(lightX / pageWorldSize, 1);
    const pageV = MathUtils.euclideanModulo(lightY / pageWorldSize, 1);
    const relativeDepth = -worldPosition.y / absoluteSunY;
    const minimumDepth = -this.maximumWorldY.value / absoluteSunY;
    const maximumDepth = -this.minimumWorldY.value / absoluteSunY;
    const normalizedDepth =
      (relativeDepth - minimumDepth) / (maximumDepth - minimumDepth);
    const isOutOfRange =
      worldPosition.y < this.minimumWorldY.value ||
      worldPosition.y > this.maximumWorldY.value ||
      absoluteSunY < minimumSunY ||
      absoluteSunY > maximumSunY;

    return {
      pageX,
      pageY,
      pageU,
      pageV,
      normalizedDepth,
      isOutOfRange,
    } satisfies ShadowPageAddress;
  }

  private syncVerticalBounds() {
    const terrainMinimum =
      this.terrainMinimumY - shadowPageCoordinateConfig.terrainBelowPadding;
    const terrainMaximum =
      this.terrainMaximumY + shadowPageCoordinateConfig.casterAboveTerrain;
    this.minimumWorldY.value = Math.floor(
      Math.min(terrainMinimum, this.registeredCasterMinimumY),
    );
    this.maximumWorldY.value = Math.ceil(
      Math.max(terrainMaximum, this.registeredCasterMaximumY),
    );
  }
}
