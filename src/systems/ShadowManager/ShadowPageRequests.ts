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
  SHADOW_LEVEL_COUNT,
  SHADOW_PAGE_COUNT,
  SHADOW_PAGE_TEXELS,
  getShadowDynamicLevel,
  getShadowReceiverLevel,
  getShadowLightPosition,
  getShadowPageCoordinate,
  getShadowPageKey,
  getShadowPageSize,
  getShadowWindowCenter,
  isShadowPageInWindow,
  shadowDynamicLevel,
  shadowResolutionBias,
  shadowSoftReceiverLevelBias,
} from "./ShadowPageCoordinates";

const TILE_SIZE = 8;
const FILTER_TEXELS = 3;
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
  private previousResolutionBias = -1;
  private previousDynamicLevel = -1;
  private previousSoftReceiverLevelBias = -1;
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
  private depthNode;
  private softReceiverNode;
  private projectionMatrixInverse: Node<"mat4">;
  private cameraWorldMatrix: Node<"mat4">;
  private sunDirection: Node<"vec3">;
  private resetNode;
  private requestNode;

  constructor(
    renderer: WebGPURenderer,
    depthTexture: Texture,
    projectionMatrixInverse: Node<"mat4">,
    cameraWorldMatrix: Node<"mat4">,
    softReceiverTexture: Texture,
    cameraPosition: Node<"vec3">,
    sunDirection: Node<"vec3">,
  ) {
    this.renderer = renderer;
    this.depthNode = texture(depthTexture);
    this.softReceiverNode = texture(softReceiverTexture);
    this.projectionMatrixInverse = projectionMatrixInverse;
    this.cameraWorldMatrix = cameraWorldMatrix;
    this.sunDirection = sunDirection;

    this.resetNode = Fn(() => {
      atomicStore(this.atomicRequestBits.element(instanceIndex), 0);
      If(instanceIndex.lessThan(4), () => {
        atomicStore(this.atomicCounters.element(instanceIndex), 0);
      });
    })().compute(REQUEST_WORD_COUNT, [64]);

    this.requestNode = Fn(() => {
      const tile = uvec2(globalId.xy);
      const minimumLevel = uint(SHADOW_LEVEL_COUNT).toVar();
      const maximumLevel = uint(0).toVar();
      Loop({ start: 0, end: TILE_SIZE, type: "uint" }, ({ i: localYIndex }) => {
        const localY = localYIndex.toVar();
        Loop(
          { start: 0, end: TILE_SIZE, type: "uint" },
          ({ i: localXIndex }) => {
            const localX = localXIndex.toVar();
            const receiver = this.loadReceiver(tile, localX, localY);
            If(receiver.isValid, () => {
              minimumLevel.assign(
                receiver.level
                  .lessThan(minimumLevel)
                  .select(receiver.level, minimumLevel),
              );
              maximumLevel.assign(
                receiver.level
                  .greaterThan(maximumLevel)
                  .select(receiver.level, maximumLevel),
              );
            });
          },
        );
      });
      Loop(
        {
          start: minimumLevel,
          end: getShadowDynamicLevel(maximumLevel).add(1),
          type: "uint",
        },
        ({ i: levelIndex }) => {
          const level = levelIndex.toVar();
          const minimum = vec2(INVALID_MINIMUM).toVar();
          const maximum = vec2(INVALID_MAXIMUM).toVar();
          Loop(
            { start: 0, end: TILE_SIZE, type: "uint" },
            ({ i: localYIndex }) => {
              const localY = localYIndex.toVar();
              Loop(
                { start: 0, end: TILE_SIZE, type: "uint" },
                ({ i: localXIndex }) => {
                  const localX = localXIndex.toVar();
                  const receiver = this.loadReceiver(tile, localX, localY);
                  const isLevelReceiver = receiver.level
                    .equal(level)
                    .or(getShadowDynamicLevel(receiver.level).equal(level));
                  If(receiver.isValid.and(isLevelReceiver), () => {
                    minimum.assign(minimum.min(receiver.lightPosition));
                    maximum.assign(maximum.max(receiver.lightPosition));
                  });
                },
              );
            },
          );
          If(minimum.x.lessThan(INVALID_MINIMUM), () => {
            const pageSize = getShadowPageSize(level);
            const filterMargin = pageSize.mul(
              FILTER_TEXELS / SHADOW_PAGE_TEXELS,
            );
            const firstPage = getShadowPageCoordinate(
              minimum.sub(filterMargin).div(pageSize),
            );
            const lastPage = getShadowPageCoordinate(
              maximum.add(filterMargin).div(pageSize),
            );
            const windowCenter = getShadowWindowCenter(
              cameraPosition,
              sunDirection,
              level,
            );
            const pageWidth = lastPage.x.sub(firstPage.x).add(1);
            const pageHeight = lastPage.y.sub(firstPage.y).add(1);
            Loop(
              {
                start: 0,
                end: pageWidth.mul(pageHeight),
                type: "uint",
              },
              ({ i: pageLoopIndex }) => {
                const pageIndex = pageLoopIndex.toVar();
                const pageCoordinate = firstPage.add(
                  uvec2(pageIndex.mod(pageWidth), pageIndex.div(pageWidth)),
                );
                If(isShadowPageInWindow(pageCoordinate, windowCenter), () => {
                  const key = getShadowPageKey(level, pageCoordinate);
                  const bit = uint(1).shiftLeft(key.mod(32));
                  const previous = atomicOr(
                    this.atomicRequestBits.element(key.div(32)),
                    bit,
                  );
                  If(previous.bitAnd(bit).equal(0), () => {
                    atomicAdd(this.atomicCounters.element(0), 1);
                  });
                }).Else(() => {
                  atomicAdd(this.atomicCounters.element(1), 1);
                });
              },
            );
          });
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

  private loadReceiver(
    tile: Node<"uvec2">,
    localX: Node<"uint">,
    localY: Node<"uint">,
  ) {
    const pixel = tile.mul(TILE_SIZE).add(uvec2(localX, localY));
    const isInside = pixel.x
      .lessThan(uint(this.depthSize.x))
      .and(pixel.y.lessThan(uint(this.depthSize.y)));
    const depth = textureLoad(this.depthNode, pixel).level(uint(0)).r;
    const uv = vec2(pixel).add(0.5).div(this.depthSize);
    const viewPosition = getViewPosition(
      uv,
      depth,
      this.projectionMatrixInverse,
    );
    const worldPosition = this.cameraWorldMatrix.mul(vec4(viewPosition, 1)).xyz;
    return {
      isValid: isInside.and(depth.lessThan(1)),
      level: getShadowReceiverLevel(
        viewPosition.length(),
        textureLoad(this.softReceiverNode, pixel)
          .level(uint(0))
          .r.greaterThan(0.5),
      ),
      lightPosition: getShadowLightPosition(worldPosition, this.sunDirection),
    };
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
      this.previousReceiverRevision === receiverRevision &&
      this.previousResolutionBias === shadowResolutionBias.value &&
      this.previousDynamicLevel === shadowDynamicLevel.value &&
      this.previousSoftReceiverLevelBias === shadowSoftReceiverLevelBias.value
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
    this.previousResolutionBias = shadowResolutionBias.value;
    this.previousDynamicLevel = shadowDynamicLevel.value;
    this.previousSoftReceiverLevelBias = shadowSoftReceiverLevelBias.value;
  }
}
