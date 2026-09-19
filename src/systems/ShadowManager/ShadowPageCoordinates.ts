import { MathUtils, Vector3 } from "three";
import type { Texture } from "three";
import type { Node } from "three/webgpu";
import { uniform, vec2, vec3 } from "three/tsl";

export const shadowPageCoordinateConfig = Object.freeze({
  pageWorldSize: 32,
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
};

export const computeGpuShadowPageAddress = (args: GpuPageAddressArgs) => {
  const { worldPosition, sunDirection, minimumWorldY, maximumWorldY } = args;
  const absoluteSunY = sunDirection.y.abs().max(0.0001);
  const horizontalSunLength = sunDirection.xz.length().max(0.0001);
  const lightXAxis = vec3(
    sunDirection.z,
    0,
    sunDirection.x.negate(),
  ).div(horizontalSunLength);
  const lightYAxis = sunDirection.cross(lightXAxis).normalize();
  const lightPosition = vec2(
    worldPosition.dot(lightXAxis),
    worldPosition.dot(lightYAxis),
  );
  const pagePosition = lightPosition.div(
    shadowPageCoordinateConfig.pageWorldSize,
  );
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

  computeAddress(worldPosition: Vector3, sunDirection: Vector3) {
    const absoluteSunY = Math.max(Math.abs(sunDirection.y), 0.0001);
    this.lightXAxis
      .set(sunDirection.z, 0, -sunDirection.x)
      .normalize();
    this.lightYAxis.crossVectors(sunDirection, this.lightXAxis).normalize();

    const lightX = worldPosition.dot(this.lightXAxis);
    const lightY = worldPosition.dot(this.lightYAxis);
    const pageX = Math.floor(
      lightX / shadowPageCoordinateConfig.pageWorldSize,
    );
    const pageY = Math.floor(
      lightY / shadowPageCoordinateConfig.pageWorldSize,
    );
    const pageU = MathUtils.euclideanModulo(
      lightX / shadowPageCoordinateConfig.pageWorldSize,
      1,
    );
    const pageV = MathUtils.euclideanModulo(
      lightY / shadowPageCoordinateConfig.pageWorldSize,
      1,
    );
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
