import { Vector3 } from "three";
import type { Node } from "three/webgpu";
import { ceil, float, log2, uint, uniform, uvec2, vec2, vec3 } from "three/tsl";

export const SHADOW_PAGE_TEXELS = 128;
export const SHADOW_PAGE_GRID_SIZE = 128;
export const SHADOW_PAGE_WINDOW_HALF = SHADOW_PAGE_GRID_SIZE / 2;
export const SHADOW_PAGES_PER_LEVEL = SHADOW_PAGE_GRID_SIZE ** 2;
export const SHADOW_FIRST_LEVEL = 5;
export const SHADOW_LAST_LEVEL = 11;
export const SHADOW_LEVEL_COUNT = SHADOW_LAST_LEVEL - SHADOW_FIRST_LEVEL + 1;
export const SHADOW_PAGE_COUNT = SHADOW_PAGES_PER_LEVEL * SHADOW_LEVEL_COUNT;
export const SHADOW_PAGE_OFFSET = 1 << 20;
const TAG_MASK = 0x3fff;
const FIRST_PAGE_SIZE = 2 ** (SHADOW_FIRST_LEVEL + 1) / SHADOW_PAGE_GRID_SIZE;

export const shadowResolutionBias = uniform(2);
export const shadowSoftReceiverLevelBias = uniform(2);

export const getShadowLightBasis = (sunDirection: Node<"vec3">) => {
  const horizontalLength = sunDirection.xz.length();
  const lightX = horizontalLength
    .lessThan(0.0001)
    .select(
      vec3(1, 0, 0),
      vec3(sunDirection.z, 0, sunDirection.x.negate()).div(
        horizontalLength.max(0.0001),
      ),
    );
  const lightY = sunDirection.cross(lightX).normalize();
  return { lightX, lightY };
};

export const getShadowLightPosition = (
  worldPosition: Node<"vec3">,
  sunDirection: Node<"vec3">,
) => {
  const { lightX, lightY } = getShadowLightBasis(sunDirection);
  return vec2(worldPosition.dot(lightX), worldPosition.dot(lightY));
};

export const getShadowLevel = (viewDistance: Node<"float">) =>
  uint(
    ceil(log2(viewDistance.max(0.0001)))
      .add(shadowResolutionBias)
      .sub(SHADOW_FIRST_LEVEL)
      .clamp(0, SHADOW_LEVEL_COUNT - 1),
  );

export const getShadowReceiverLevel = (
  viewDistance: Node<"float">,
  isSoftReceiver: Node<"bool">,
) =>
  uint(
    ceil(log2(viewDistance.max(0.0001)))
      .add(shadowResolutionBias)
      .add(isSoftReceiver.select(shadowSoftReceiverLevelBias, float(0)))
      .sub(SHADOW_FIRST_LEVEL)
      .clamp(0, SHADOW_LEVEL_COUNT - 1),
  );

export const getShadowPageSize = (level: Node<"uint">) =>
  float(uint(1).shiftLeft(level)).mul(FIRST_PAGE_SIZE);

export const getShadowPageTag = (pageCoordinate: Node<"uvec2">) =>
  pageCoordinate.x
    .bitAnd(TAG_MASK)
    .bitOr(pageCoordinate.y.bitAnd(TAG_MASK).shiftLeft(14));

export const getShadowPageKey = (
  level: Node<"uint">,
  pageCoordinate: Node<"uvec2">,
) =>
  level
    .mul(SHADOW_PAGES_PER_LEVEL)
    .add(
      pageCoordinate.y
        .mod(SHADOW_PAGE_GRID_SIZE)
        .mul(SHADOW_PAGE_GRID_SIZE)
        .add(pageCoordinate.x.mod(SHADOW_PAGE_GRID_SIZE)),
    );

export const getShadowPageCoordinate = (pagePosition: Node<"vec2">) =>
  pagePosition.floor().add(SHADOW_PAGE_OFFSET).toUVec2();

export const getShadowWindowCenter = (
  cameraPosition: Node<"vec3">,
  sunDirection: Node<"vec3">,
  level: Node<"uint">,
) =>
  getShadowPageCoordinate(
    getShadowLightPosition(cameraPosition, sunDirection).div(
      getShadowPageSize(level),
    ),
  );

export const getShadowWindowPage = (
  pageKey: Node<"uint">,
  windowCenter: Node<"uvec2">,
) => {
  const localKey = pageKey.mod(SHADOW_PAGES_PER_LEVEL);
  const wrapped = uvec2(
    localKey.mod(SHADOW_PAGE_GRID_SIZE),
    localKey.div(SHADOW_PAGE_GRID_SIZE),
  );
  const windowStart = windowCenter.sub(SHADOW_PAGE_WINDOW_HALF);
  return windowStart.add(
    wrapped
      .add(SHADOW_PAGE_GRID_SIZE)
      .sub(windowStart.mod(SHADOW_PAGE_GRID_SIZE))
      .mod(SHADOW_PAGE_GRID_SIZE),
  );
};

export const isShadowPageInWindow = (
  pageCoordinate: Node<"uvec2">,
  windowCenter: Node<"uvec2">,
) =>
  pageCoordinate.x
    .add(SHADOW_PAGE_WINDOW_HALF)
    .greaterThanEqual(windowCenter.x)
    .and(
      pageCoordinate.y
        .add(SHADOW_PAGE_WINDOW_HALF)
        .greaterThanEqual(windowCenter.y),
    )
    .and(pageCoordinate.x.lessThan(windowCenter.x.add(SHADOW_PAGE_WINDOW_HALF)))
    .and(
      pageCoordinate.y.lessThan(windowCenter.y.add(SHADOW_PAGE_WINDOW_HALF)),
    );

export class ShadowPageCoordinates {
  private lightX = new Vector3();
  private lightY = new Vector3();

  getPageCoordinate(position: Vector3, sunDirection: Vector3, level: number) {
    const horizontalLength = Math.hypot(sunDirection.x, sunDirection.z);
    if (horizontalLength < 0.0001) this.lightX.set(1, 0, 0);
    else
      this.lightX.set(
        sunDirection.z / horizontalLength,
        0,
        -sunDirection.x / horizontalLength,
      );
    this.lightY.crossVectors(sunDirection, this.lightX).normalize();
    const pageSize = FIRST_PAGE_SIZE * 2 ** level;
    return {
      x: Math.floor(position.dot(this.lightX) / pageSize) + SHADOW_PAGE_OFFSET,
      y: Math.floor(position.dot(this.lightY) / pageSize) + SHADOW_PAGE_OFFSET,
    };
  }
}
