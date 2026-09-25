import { Vector3 } from "three";
import type { Node } from "three/webgpu";
import { float, uint, vec2, vec3 } from "three/tsl";

export const SHADOW_PAGE_GRID_SIZE = 128;
export const SHADOW_PAGE_GRID_MIN = -SHADOW_PAGE_GRID_SIZE / 2;
export const SHADOW_PAGES_PER_LEVEL = SHADOW_PAGE_GRID_SIZE ** 2;
export const SHADOW_PAGE_LEVEL_COUNT = 2;
export const SHADOW_PAGE_COUNT =
  SHADOW_PAGES_PER_LEVEL * SHADOW_PAGE_LEVEL_COUNT;
export const SHADOW_PAGE_WORLD_SIZE = 32;
export const SHADOW_NEAR_END = 128;
export const SHADOW_FAR_START = 96;

export const decodeGpuShadowPageKey = (pageKey: Node<"uint">) => {
  const level = pageKey.div(SHADOW_PAGES_PER_LEVEL);
  const localKey = pageKey.mod(SHADOW_PAGES_PER_LEVEL);
  const pageId = vec2(
    float(localKey.mod(SHADOW_PAGE_GRID_SIZE)),
    float(localKey.div(SHADOW_PAGE_GRID_SIZE)),
  ).add(SHADOW_PAGE_GRID_MIN);
  return { level, pageId };
};

export const getGpuShadowPageAddress = (
  worldPosition: Node<"vec3">,
  sunDirection: Node<"vec3">,
  level: Node<"uint">,
) => {
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
  const lightPosition = vec2(
    worldPosition.dot(lightX),
    worldPosition.dot(lightY),
  );
  const pageSize = level
    .equal(uint(0))
    .select(float(SHADOW_PAGE_WORLD_SIZE), float(SHADOW_PAGE_WORLD_SIZE * 2));
  const pagePosition = lightPosition.div(pageSize);
  const pageId = pagePosition.floor();
  const isInsideGrid = pageId.x
    .greaterThanEqual(SHADOW_PAGE_GRID_MIN)
    .and(pageId.x.lessThan(SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE))
    .and(pageId.y.greaterThanEqual(SHADOW_PAGE_GRID_MIN))
    .and(pageId.y.lessThan(SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE));
  const boundedPageId = pageId
    .max(SHADOW_PAGE_GRID_MIN)
    .min(SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE - 1);
  const pageKey = level.mul(SHADOW_PAGES_PER_LEVEL).add(
    uint(boundedPageId.y.sub(SHADOW_PAGE_GRID_MIN))
      .mul(SHADOW_PAGE_GRID_SIZE)
      .add(uint(boundedPageId.x.sub(SHADOW_PAGE_GRID_MIN))),
  );

  return { pageId, pageUv: pagePosition.fract(), isInsideGrid, pageKey };
};

export class ShadowPageCoordinates {
  private lightX = new Vector3();
  private lightY = new Vector3();

  getPageCenter(position: Vector3, sunDirection: Vector3, level: number) {
    const horizontalLength = Math.hypot(sunDirection.x, sunDirection.z);
    if (horizontalLength < 0.0001) this.lightX.set(1, 0, 0);
    else
      this.lightX.set(
        sunDirection.z / horizontalLength,
        0,
        -sunDirection.x / horizontalLength,
      );
    this.lightY.crossVectors(sunDirection, this.lightX).normalize();
    const pageSize = SHADOW_PAGE_WORLD_SIZE * (level + 1);
    return {
      x: Math.floor(position.dot(this.lightX) / pageSize),
      y: Math.floor(position.dot(this.lightY) / pageSize),
    };
  }
}
