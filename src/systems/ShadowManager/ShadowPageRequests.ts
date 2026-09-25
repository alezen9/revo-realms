import { Matrix4, Vector2, Vector3, type Camera, type Texture } from "three";
import {
  StorageBufferAttribute,
  type Node,
  type WebGPURenderer,
} from "three/webgpu";
import {
  atomicAdd,
  atomicOr,
  atomicStore,
  float,
  Fn,
  getViewPosition,
  globalId,
  If,
  instanceIndex,
  Loop,
  storage,
  texture,
  textureLoad,
  uint,
  uniform,
  uvec2,
  vec2,
  vec4,
} from "three/tsl";
import {
  SHADOW_FAR_START,
  SHADOW_NEAR_END,
  SHADOW_PAGE_COUNT,
  SHADOW_PAGE_GRID_MIN,
  SHADOW_PAGE_GRID_SIZE,
  SHADOW_PAGES_PER_LEVEL,
  SHADOW_PAGE_WORLD_SIZE,
} from "./ShadowPageCoordinates";

const TILE_SIZE = 8;
const REQUEST_WORD_COUNT = SHADOW_PAGE_COUNT / 32;
const INVALID_MINIMUM = 1e8;
const INVALID_MAXIMUM = -1e8;

export class ShadowPageRequests {
  private renderer: WebGPURenderer;
  private depthSize = uniform(new Vector2(1, 1));
  private drawingBufferSize = new Vector2();
  private previousCamera?: Camera;
  private previousCameraMatrix = new Matrix4();
  private previousProjectionMatrix = new Matrix4();
  private previousSunDirection = new Vector3();
  private previousDrawingBufferSize = new Vector2();
  private previousReceiverRevision = -1;
  private requestBits = new StorageBufferAttribute(
    new Uint32Array(REQUEST_WORD_COUNT),
    1,
  );
  private atomicRequestBits = storage(
    this.requestBits,
    "uint",
    REQUEST_WORD_COUNT,
  ).toAtomic();
  private counters = new StorageBufferAttribute(new Uint32Array(4), 1);
  private atomicCounters = storage(this.counters, "uint", 4).toAtomic();
  private resetNode;
  private requestNode;

  constructor(
    renderer: WebGPURenderer,
    depthTexture: Texture,
    projectionMatrixInverse: Node<"mat4">,
    cameraWorldMatrix: Node<"mat4">,
    sunDirection: Node<"vec3">,
  ) {
    this.renderer = renderer;
    const depthNode = texture(depthTexture);

    this.resetNode = Fn(() => {
      atomicStore(this.atomicRequestBits.element(instanceIndex), 0);
      If(instanceIndex.lessThan(4), () => {
        atomicStore(this.atomicCounters.element(instanceIndex), 0);
      });
    })().compute(REQUEST_WORD_COUNT, [64]);

    this.requestNode = Fn(() => {
      const tile = uvec2(globalId.xy);
      const nearMinimum = vec4(INVALID_MINIMUM).toVar();
      const nearMaximum = vec4(INVALID_MAXIMUM).toVar();
      const farMinimum = vec4(INVALID_MINIMUM).toVar();
      const farMaximum = vec4(INVALID_MAXIMUM).toVar();
      const horizontalLength = sunDirection.xz.length();
      const lightX = horizontalLength
        .lessThan(0.0001)
        .select(
          vec4(1, 0, 0, 0).xyz,
          vec4(sunDirection.z, 0, sunDirection.x.negate(), 0).xyz.div(
            horizontalLength.max(0.0001),
          ),
        );
      const lightY = sunDirection.cross(lightX).normalize();
      If(
        tile.x
          .mul(TILE_SIZE)
          .lessThan(uint(this.depthSize.x))
          .and(tile.y.mul(TILE_SIZE).lessThan(uint(this.depthSize.y))),
        () => {
          Loop({ start: 0, end: TILE_SIZE, type: "uint" }, ({ i: localY }) => {
            Loop(
              { start: 0, end: TILE_SIZE, type: "uint" },
              ({ i: localX }) => {
                const pixel = tile.mul(TILE_SIZE).add(uvec2(localX, localY));
                If(
                  pixel.x
                    .lessThan(uint(this.depthSize.x))
                    .and(pixel.y.lessThan(uint(this.depthSize.y))),
                  () => {
                    const depth = textureLoad(depthNode, pixel).level(
                      uint(0),
                    ).r;
                    If(depth.lessThan(1), () => {
                      const uv = vec2(pixel).add(0.5).div(this.depthSize);
                      const viewPosition = getViewPosition(
                        uv,
                        depth,
                        projectionMatrixInverse,
                      );
                      const worldPosition = cameraWorldMatrix.mul(
                        vec4(viewPosition, 1),
                      ).xyz;
                      const lightPosition = vec2(
                        worldPosition.dot(lightX),
                        worldPosition.dot(lightY),
                      );
                      const sample = vec4(
                        lightPosition,
                        viewPosition.z.negate(),
                        0,
                      );
                      If(sample.z.lessThan(SHADOW_NEAR_END), () => {
                        nearMinimum.assign(nearMinimum.min(sample));
                        nearMaximum.assign(nearMaximum.max(sample));
                      });
                      If(sample.z.greaterThanEqual(SHADOW_FAR_START), () => {
                        farMinimum.assign(farMinimum.min(sample));
                        farMaximum.assign(farMaximum.max(sample));
                      });
                    });
                  },
                );
              },
            );
          });
          for (const levelIndex of [0, 1]) {
            const level = uint(levelIndex);
            const minimum = level
              .equal(uint(0))
              .select(nearMinimum, farMinimum);
            const maximum = level
              .equal(uint(0))
              .select(nearMaximum, farMaximum);
            const isNeeded = minimum.x.lessThan(INVALID_MINIMUM);
            If(isNeeded, () => {
              const pageSize = level
                .equal(uint(0))
                .select(
                  float(SHADOW_PAGE_WORLD_SIZE),
                  float(SHADOW_PAGE_WORLD_SIZE * 2),
                );
              const firstPage = minimum.xy.div(pageSize).floor().sub(1);
              const lastPage = maximum.xy.div(pageSize).floor().add(1);
              const firstX = firstPage.x.max(SHADOW_PAGE_GRID_MIN).toInt();
              const firstY = firstPage.y.max(SHADOW_PAGE_GRID_MIN).toInt();
              const lastX = lastPage.x
                .min(SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE - 1)
                .toInt();
              const lastY = lastPage.y
                .min(SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE - 1)
                .toInt();
              If(
                firstPage.x
                  .lessThan(SHADOW_PAGE_GRID_MIN)
                  .or(firstPage.y.lessThan(SHADOW_PAGE_GRID_MIN))
                  .or(
                    lastPage.x.greaterThanEqual(
                      SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE,
                    ),
                  )
                  .or(
                    lastPage.y.greaterThanEqual(
                      SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE,
                    ),
                  ),
                () => {
                  atomicAdd(this.atomicCounters.element(3), 1);
                },
              );
              If(
                firstX.lessThanEqual(lastX).and(firstY.lessThanEqual(lastY)),
                () => {
                  const pageWidth = lastX.sub(firstX).add(1);
                  const pageHeight = lastY.sub(firstY).add(1);
                  Loop(
                    { start: 0, end: pageWidth.mul(pageHeight), type: "int" },
                    ({ i: pageIndex }) => {
                      const pageX = firstX.add(pageIndex.mod(pageWidth));
                      const pageY = firstY.add(pageIndex.div(pageWidth));
                      const key = level.mul(SHADOW_PAGES_PER_LEVEL).add(
                        uint(pageY.sub(SHADOW_PAGE_GRID_MIN))
                          .mul(SHADOW_PAGE_GRID_SIZE)
                          .add(uint(pageX.sub(SHADOW_PAGE_GRID_MIN))),
                      );
                      const word = key.div(32);
                      const bit = uint(1).shiftLeft(key.mod(32));
                      const previous = atomicOr(
                        this.atomicRequestBits.element(word),
                        bit,
                      );
                      If(previous.bitAnd(bit).equal(0), () => {
                        atomicAdd(this.atomicCounters.element(0), 1);
                        atomicAdd(this.atomicCounters.element(level.add(1)), 1);
                      });
                    },
                  );
                },
              );
            });
          }
        },
      );
    })().computeKernel([TILE_SIZE, TILE_SIZE]);

    this.resetNode.name = "V2 page request reset";
    this.requestNode.name = "V2 receiver page requests";
  }

  get bitsAttribute() {
    return this.requestBits;
  }

  get countersAttribute() {
    return this.counters;
  }

  run(camera: Camera, sunDirection: Vector3, receiverRevision: number) {
    this.renderer.getDrawingBufferSize(this.drawingBufferSize);
    const width = Math.max(1, Math.floor(this.drawingBufferSize.x));
    const height = Math.max(1, Math.floor(this.drawingBufferSize.y));
    if (
      camera === this.previousCamera &&
      this.previousCameraMatrix.equals(camera.matrixWorld) &&
      this.previousProjectionMatrix.equals(camera.projectionMatrix) &&
      this.previousSunDirection.equals(sunDirection) &&
      this.previousDrawingBufferSize.x === width &&
      this.previousDrawingBufferSize.y === height &&
      this.previousReceiverRevision === receiverRevision
    )
      return;
    this.depthSize.value.set(width, height);
    this.renderer.compute(this.resetNode);
    this.renderer.compute(this.requestNode, [
      Math.ceil(width / (TILE_SIZE * TILE_SIZE)),
      Math.ceil(height / (TILE_SIZE * TILE_SIZE)),
      1,
    ]);
    this.previousCamera = camera;
    this.previousCameraMatrix.copy(camera.matrixWorld);
    this.previousProjectionMatrix.copy(camera.projectionMatrix);
    this.previousSunDirection.copy(sunDirection);
    this.previousDrawingBufferSize.set(width, height);
    this.previousReceiverRevision = receiverRevision;
  }
}
