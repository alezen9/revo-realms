import { Vector3 } from "three";
import type { Node } from "three/webgpu";
import { ceil, float, log2, uint, uniform, uvec2, vec2, vec3 } from "three/tsl";

export const VSM_PAGE_TEXELS = 128;
export const VSM_PAGE_GRID_SIZE = 128;
export const VSM_PAGE_WINDOW_HALF = VSM_PAGE_GRID_SIZE / 2;
export const VSM_PAGES_PER_LEVEL = VSM_PAGE_GRID_SIZE ** 2;
export const VSM_FIRST_LEVEL = 5;
export const VSM_LAST_LEVEL = 11;
export const VSM_LEVEL_COUNT = VSM_LAST_LEVEL - VSM_FIRST_LEVEL + 1;
export const VSM_PAGE_COUNT = VSM_PAGES_PER_LEVEL * VSM_LEVEL_COUNT;
export const VSM_PAGE_OFFSET = 1 << 20;
const TAG_MASK = 0x3fff;
const FIRST_PAGE_SIZE = 2 ** (VSM_FIRST_LEVEL + 1) / VSM_PAGE_GRID_SIZE;

export const vsmResolutionBias = uniform(2);
export const vsmSoftReceiverLevelBias = uniform(4);

export const getLightBasis = (sunDirection: Node<"vec3">) => {
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

export const getLightPosition = (
  worldPosition: Node<"vec3">,
  sunDirection: Node<"vec3">,
) => {
  const { lightX, lightY } = getLightBasis(sunDirection);
  return vec2(worldPosition.dot(lightX), worldPosition.dot(lightY));
};

export const getReceiverLevel = (
  viewDistance: Node<"float">,
  isSoftReceiver: Node<"bool">,
) =>
  uint(
    ceil(log2(viewDistance.max(0.0001)))
      .add(vsmResolutionBias)
      .add(isSoftReceiver.select(vsmSoftReceiverLevelBias, float(0)))
      .sub(VSM_FIRST_LEVEL)
      .clamp(0, VSM_LEVEL_COUNT - 1),
  );

export const getPageSize = (level: Node<"uint">) =>
  float(uint(1).shiftLeft(level)).mul(FIRST_PAGE_SIZE);

export const getPageTag = (pageCoordinate: Node<"uvec2">) =>
  pageCoordinate.x
    .bitAnd(TAG_MASK)
    .bitOr(pageCoordinate.y.bitAnd(TAG_MASK).shiftLeft(14));

export const getPageKey = (
  level: Node<"uint">,
  pageCoordinate: Node<"uvec2">,
) =>
  level
    .mul(VSM_PAGES_PER_LEVEL)
    .add(
      pageCoordinate.y
        .mod(VSM_PAGE_GRID_SIZE)
        .mul(VSM_PAGE_GRID_SIZE)
        .add(pageCoordinate.x.mod(VSM_PAGE_GRID_SIZE)),
    );

export const getPageCoordinate = (pagePosition: Node<"vec2">) =>
  pagePosition.floor().add(VSM_PAGE_OFFSET).toUVec2();

export const getWindowCenter = (
  cameraPosition: Node<"vec3">,
  sunDirection: Node<"vec3">,
  level: Node<"uint">,
) =>
  getPageCoordinate(
    getLightPosition(cameraPosition, sunDirection).div(getPageSize(level)),
  );

export const getWindowPage = (
  pageKey: Node<"uint">,
  windowCenter: Node<"uvec2">,
) => {
  const localKey = pageKey.mod(VSM_PAGES_PER_LEVEL);
  const wrapped = uvec2(
    localKey.mod(VSM_PAGE_GRID_SIZE),
    localKey.div(VSM_PAGE_GRID_SIZE),
  );
  const windowStart = windowCenter.sub(VSM_PAGE_WINDOW_HALF);
  return windowStart.add(
    wrapped
      .add(VSM_PAGE_GRID_SIZE)
      .sub(windowStart.mod(VSM_PAGE_GRID_SIZE))
      .mod(VSM_PAGE_GRID_SIZE),
  );
};

export const isPageInWindow = (
  pageCoordinate: Node<"uvec2">,
  windowCenter: Node<"uvec2">,
) =>
  pageCoordinate.x
    .add(VSM_PAGE_WINDOW_HALF)
    .greaterThanEqual(windowCenter.x)
    .and(
      pageCoordinate.y
        .add(VSM_PAGE_WINDOW_HALF)
        .greaterThanEqual(windowCenter.y),
    )
    .and(pageCoordinate.x.lessThan(windowCenter.x.add(VSM_PAGE_WINDOW_HALF)))
    .and(pageCoordinate.y.lessThan(windowCenter.y.add(VSM_PAGE_WINDOW_HALF)));

const cpuLightX = new Vector3();
const cpuLightY = new Vector3();

export const computePageCoordinate = (
  position: Vector3,
  sunDirection: Vector3,
  level: number,
) => {
  const horizontalLength = Math.hypot(sunDirection.x, sunDirection.z);
  if (horizontalLength < 0.0001) cpuLightX.set(1, 0, 0);
  else
    cpuLightX.set(
      sunDirection.z / horizontalLength,
      0,
      -sunDirection.x / horizontalLength,
    );
  cpuLightY.crossVectors(sunDirection, cpuLightX).normalize();
  const pageSize = FIRST_PAGE_SIZE * 2 ** level;
  return {
    x: Math.floor(position.dot(cpuLightX) / pageSize) + VSM_PAGE_OFFSET,
    y: Math.floor(position.dot(cpuLightY) / pageSize) + VSM_PAGE_OFFSET,
  };
};
