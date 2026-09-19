import { Vector2, Vector3 } from "three";
import type { Texture } from "three";
import { StorageBufferAttribute, type WebGPURenderer } from "three/webgpu";
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
  int,
  ivec2,
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
import type { Node } from "three/webgpu";
import { shadowConfig } from "./config";
import {
  computeGpuShadowPageAddress,
  ShadowPageCoordinates,
} from "./ShadowPageCoordinates";
import { updateShadowRequestTelemetry } from "./telemetry";

const PAGE_GRID_SIZE = 128;
const MINIMUM_PAGE_COORDINATE = -PAGE_GRID_SIZE / 2;
const PAGE_COUNT = PAGE_GRID_SIZE * PAGE_GRID_SIZE;
const REQUEST_WORD_COUNT = PAGE_COUNT / 32;
const COUNTER_COUNT = 4;
const REQUESTED_PAGE_COUNTER = 0;
const OVERFLOW_PAGE_COUNTER = 1;
const RECEIVER_PIXEL_COUNTER = 2;
const OUTSIDE_GRID_COUNTER = 3;
const DIAGNOSTIC_SAMPLE_COUNT = 8;
const DENSITY_GRID_SIZE = 64;
const DENSITY_SAMPLE_COUNT = DENSITY_GRID_SIZE * DENSITY_GRID_SIZE;
const INVALID_DIAGNOSTIC_PAGE = -1;
const READBACK_INTERVAL_MS = 1_000;

type ConstructorArgs = {
  renderer: WebGPURenderer;
  depthTexture: Texture;
  projectionMatrixInverse: Node<"mat4">;
  cameraWorldMatrix: Node<"mat4">;
  sunDirectionNode: Node<"vec3">;
  sunDirection: Vector3;
  coordinates: ShadowPageCoordinates;
};

export class ShadowPageRequests {
  private renderer: WebGPURenderer;
  private sunDirection: Vector3;
  private coordinates: ShadowPageCoordinates;
  private depthSize = uniform(new Vector2(1, 1));
  private receiverBits = new StorageBufferAttribute(
    new Uint32Array(REQUEST_WORD_COUNT),
    1,
  );
  private atomicReceiverBits = storage(
    this.receiverBits,
    "uint",
    this.receiverBits.count,
  ).toAtomic();
  private requestBits = new StorageBufferAttribute(
    new Uint32Array(REQUEST_WORD_COUNT),
    1,
  );
  private atomicRequestBits = storage(
    this.requestBits,
    "uint",
    this.requestBits.count,
  ).toAtomic();
  private requestList = new StorageBufferAttribute(
    new Uint32Array(shadowConfig.requestCapacity),
    1,
  );
  private requestListNode = storage(
    this.requestList,
    "uint",
    this.requestList.count,
  );
  private counters = new StorageBufferAttribute(
    new Uint32Array(COUNTER_COUNT),
    1,
  );
  private atomicCounters = storage(
    this.counters,
    "uint",
    this.counters.count,
  ).toAtomic();
  private diagnosticSamples = new StorageBufferAttribute(
    new Float32Array(DIAGNOSTIC_SAMPLE_COUNT * 4),
    4,
  );
  private diagnosticSamplesNode = storage(
    this.diagnosticSamples,
    "vec4",
    this.diagnosticSamples.count,
  );
  private resetNode;
  private requestNode;
  private diagnosticNode;
  private isReadbackPending = false;
  private nextReadbackTime = 0;

  constructor(args: ConstructorArgs) {
    const {
      renderer,
      depthTexture,
      projectionMatrixInverse,
      cameraWorldMatrix,
      sunDirectionNode,
      sunDirection,
      coordinates,
    } = args;
    this.renderer = renderer;
    this.sunDirection = sunDirection;
    this.coordinates = coordinates;
    const nodes = this.createComputeNodes(
      depthTexture,
      projectionMatrixInverse,
      cameraWorldMatrix,
      sunDirectionNode,
    );
    this.resetNode = nodes.reset;
    this.requestNode = nodes.request;
    this.diagnosticNode = nodes.diagnostic;
  }

  run() {
    this.renderer.getDrawingBufferSize(this.depthSize.value);
    const width = Math.max(1, Math.floor(this.depthSize.value.x));
    const height = Math.max(1, Math.floor(this.depthSize.value.y));
    const requestWidth = Math.ceil(width / shadowConfig.requestStride);
    const requestHeight = Math.ceil(height / shadowConfig.requestStride);
    const now = performance.now();
    const shouldReadback =
      !this.isReadbackPending && now >= this.nextReadbackTime;
    this.renderer.compute(this.resetNode);
    this.renderer.compute(this.requestNode, [
      Math.ceil(requestWidth / 8),
      Math.ceil(requestHeight / 8),
      1,
    ]);
    if (!shouldReadback) return;
    this.renderer.compute(this.diagnosticNode);
    this.nextReadbackTime = now + READBACK_INTERVAL_MS;
    this.isReadbackPending = true;
    void this.refreshTelemetryAsync();
  }

  private createComputeNodes(
    depthTexture: Texture,
    projectionMatrixInverse: Node<"mat4">,
    cameraWorldMatrix: Node<"mat4">,
    sunDirection: Node<"vec3">,
  ) {
    const depthTextureNode = texture(depthTexture);

    const reset = Fn(() => {
      If(instanceIndex.lessThan(REQUEST_WORD_COUNT), () => {
        atomicStore(this.atomicReceiverBits.element(instanceIndex), 0);
        atomicStore(this.atomicRequestBits.element(instanceIndex), 0);
      });
      If(instanceIndex.lessThan(COUNTER_COUNT), () => {
        atomicStore(this.atomicCounters.element(instanceIndex), 0);
      });
    })().compute(REQUEST_WORD_COUNT, [64]);

    const request = Fn(() => {
      const pixel = uvec2(globalId.xy)
        .mul(shadowConfig.requestStride)
        .add(shadowConfig.requestStride - 1);
      const isInsideDepth = pixel.x
        .lessThan(uint(this.depthSize.x))
        .and(pixel.y.lessThan(uint(this.depthSize.y)));
      If(isInsideDepth, () => {
        const depth0 = textureLoad(depthTextureNode, pixel).level(uint(0)).r;
        const depth1 = textureLoad(depthTextureNode, pixel).level(uint(1)).r;
        const depth2 = textureLoad(depthTextureNode, pixel).level(uint(2)).r;
        const depth3 = textureLoad(depthTextureNode, pixel).level(uint(3)).r;
        Loop({ start: 0, end: 4, type: "uint" }, ({ i: sampleIndex }) => {
          const depth = textureLoad(depthTextureNode, pixel).level(
            sampleIndex,
          ).r;
          const isUniqueDepth = sampleIndex
            .equal(0)
            .or(sampleIndex.equal(1).and(depth.notEqual(depth0)))
            .or(
              sampleIndex
                .equal(2)
                .and(depth.notEqual(depth0))
                .and(depth.notEqual(depth1)),
            )
            .or(
              sampleIndex
                .equal(3)
                .and(depth.notEqual(depth0))
                .and(depth.notEqual(depth1))
                .and(depth.notEqual(depth2)),
            );
          If(depth.lessThan(1).and(isUniqueDepth), () => {
            const uv = vec2(pixel).add(0.5).div(this.depthSize);
            const viewPosition = getViewPosition(
              uv,
              depth,
              projectionMatrixInverse,
            );
            const worldPosition = cameraWorldMatrix.mul(
              vec4(viewPosition, 1),
            ).xyz;
            const address = computeGpuShadowPageAddress({
              worldPosition,
              sunDirection,
              minimumWorldY: this.coordinates.minimumWorldY,
              maximumWorldY: this.coordinates.maximumWorldY,
            });
            const pageId = ivec2(address.pageId);
            const maximumPageCoordinate =
              MINIMUM_PAGE_COORDINATE + PAGE_GRID_SIZE;
            const isInsideGrid = pageId.x
              .greaterThanEqual(MINIMUM_PAGE_COORDINATE)
              .and(pageId.x.lessThan(maximumPageCoordinate))
              .and(pageId.y.greaterThanEqual(MINIMUM_PAGE_COORDINATE))
              .and(pageId.y.lessThan(maximumPageCoordinate));

            If(address.isOutOfRange.not(), () => {
              If(isInsideGrid, () => {
                const localPage = pageId.sub(MINIMUM_PAGE_COORDINATE);
                const pageIndex = uint(localPage.y)
                  .mul(PAGE_GRID_SIZE)
                  .add(uint(localPage.x));
                const wordIndex = pageIndex.div(32);
                const bitIndex = pageIndex.mod(32);
                const bit = uint(1).shiftLeft(bitIndex);
                const previous = atomicOr(
                  this.atomicReceiverBits.element(wordIndex),
                  bit,
                ).toVar();

                If(previous.bitAnd(bit).equal(0), () => {
                  const dilationRadius = shadowConfig.requestStride - 1;
                  Loop(
                    {
                      start: -dilationRadius,
                      end: dilationRadius + 1,
                      type: "int",
                    },
                    ({ i: offsetY }) => {
                      Loop(
                        {
                          start: -dilationRadius,
                          end: dilationRadius + 1,
                          type: "int",
                        },
                        ({ i: offsetX }) => {
                          const requestedPage = pageId.add(
                            ivec2(offsetX, offsetY),
                          );
                          const isRequestedPageInsideGrid = requestedPage.x
                            .greaterThanEqual(MINIMUM_PAGE_COORDINATE)
                            .and(
                              requestedPage.x.lessThan(maximumPageCoordinate),
                            )
                            .and(
                              requestedPage.y.greaterThanEqual(
                                MINIMUM_PAGE_COORDINATE,
                              ),
                            )
                            .and(
                              requestedPage.y.lessThan(maximumPageCoordinate),
                            );
                          If(isRequestedPageInsideGrid, () => {
                            const requestedLocalPage = requestedPage.sub(
                              MINIMUM_PAGE_COORDINATE,
                            );
                            const requestedPageIndex = uint(
                              requestedLocalPage.y,
                            )
                              .mul(PAGE_GRID_SIZE)
                              .add(uint(requestedLocalPage.x));
                            const requestedWordIndex =
                              requestedPageIndex.div(32);
                            const requestedBit = uint(1).shiftLeft(
                              requestedPageIndex.mod(32),
                            );
                            const wasRequested = atomicOr(
                              this.atomicRequestBits.element(
                                requestedWordIndex,
                              ),
                              requestedBit,
                            ).toVar();
                            If(
                              wasRequested.bitAnd(requestedBit).equal(0),
                              () => {
                                const requestIndex = atomicAdd(
                                  this.atomicCounters.element(
                                    REQUESTED_PAGE_COUNTER,
                                  ),
                                  1,
                                );
                                If(
                                  requestIndex.lessThan(
                                    shadowConfig.requestCapacity,
                                  ),
                                  () => {
                                    this.requestListNode
                                      .element(requestIndex)
                                      .assign(requestedPageIndex);
                                  },
                                ).Else(() => {
                                  atomicAdd(
                                    this.atomicCounters.element(
                                      OVERFLOW_PAGE_COUNTER,
                                    ),
                                    1,
                                  );
                                });
                              },
                            );
                          }).Else(() => {
                            atomicOr(
                              this.atomicCounters.element(OUTSIDE_GRID_COUNTER),
                              uint(1),
                            );
                          });
                        },
                      );
                    },
                  );
                });
              }).Else(() => {
                atomicOr(
                  this.atomicCounters.element(OUTSIDE_GRID_COUNTER),
                  uint(1),
                );
              });
            });
          });
        });
      });
    })().computeKernel([8, 8]);

    const diagnostic = Fn(() => {
      const maxPixel = uvec2(this.depthSize).sub(1);
      const densityX = instanceIndex.mod(DENSITY_GRID_SIZE);
      const densityY = instanceIndex.div(DENSITY_GRID_SIZE);
      const pixel = uvec2(densityX, densityY)
        .mul(maxPixel)
        .div(DENSITY_GRID_SIZE - 1)
        .toVar();
      If(instanceIndex.lessThan(DIAGNOSTIC_SAMPLE_COUNT), () => {
        const column = instanceIndex.mod(4).add(1);
        const row = instanceIndex.div(4).add(1);
        pixel.assign(
          uvec2(
            column.mul(uint(this.depthSize.x)).div(5),
            row.mul(uint(this.depthSize.y)).div(3),
          ),
        );
      });
      const depth0 = textureLoad(depthTextureNode, pixel).level(uint(0)).r;
      const depth1 = textureLoad(depthTextureNode, pixel).level(uint(1)).r;
      const depth2 = textureLoad(depthTextureNode, pixel).level(uint(2)).r;
      const depth3 = textureLoad(depthTextureNode, pixel).level(uint(3)).r;
      const depth = depth0.min(depth1).min(depth2).min(depth3);
      If(depth.lessThan(1), () => {
        atomicAdd(this.atomicCounters.element(RECEIVER_PIXEL_COUNTER), 1);
      });

      If(instanceIndex.lessThan(DIAGNOSTIC_SAMPLE_COUNT), () => {
        this.diagnosticSamplesNode
          .element(instanceIndex)
          .assign(vec4(0, 0, 0, INVALID_DIAGNOSTIC_PAGE));
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
          const address = computeGpuShadowPageAddress({
            worldPosition,
            sunDirection,
            minimumWorldY: this.coordinates.minimumWorldY,
            maximumWorldY: this.coordinates.maximumWorldY,
          });
          const pageId = ivec2(address.pageId);
          const localPage = pageId.sub(MINIMUM_PAGE_COORDINATE);
          const pageIndex = int(localPage.y)
            .mul(PAGE_GRID_SIZE)
            .add(int(localPage.x));
          this.diagnosticSamplesNode
            .element(instanceIndex)
            .assign(vec4(worldPosition, float(pageIndex)));
        });
      });
    })().compute(DENSITY_SAMPLE_COUNT, [64]);

    reset.name = "Shadow request reset";
    request.name = "Shadow page requests";
    diagnostic.name = "Shadow request diagnostics";
    return { reset, request, diagnostic };
  }

  private async refreshTelemetryAsync() {
    const diagnosticSunDirection = this.sunDirection.clone();
    try {
      const counterBuffer = await this.renderer.getArrayBufferAsync(
        this.counters,
      );
      const diagnosticBuffer = await this.renderer.getArrayBufferAsync(
        this.diagnosticSamples,
      );
      const counters = new Uint32Array(counterBuffer);
      const requestedPages = Math.min(
        counters[REQUESTED_PAGE_COUNTER],
        shadowConfig.requestCapacity,
      );
      const requestDensity =
        counters[RECEIVER_PIXEL_COUNTER] / DENSITY_SAMPLE_COUNT;
      const diagnosticMismatches = this.countDiagnosticMismatches(
        new Float32Array(diagnosticBuffer),
        diagnosticSunDirection,
      );
      updateShadowRequestTelemetry(
        requestedPages,
        requestDensity,
        counters[OVERFLOW_PAGE_COUNTER] + counters[OUTSIDE_GRID_COUNTER],
        diagnosticMismatches,
      );
    } catch (error) {
      console.error("[Shadow requests] telemetry readback failed:", error);
    } finally {
      this.isReadbackPending = false;
    }
  }

  private countDiagnosticMismatches(
    samples: Float32Array,
    sunDirection: Vector3,
  ) {
    const worldPosition = new Vector3();
    let mismatches = 0;
    for (
      let sampleIndex = 0;
      sampleIndex < DIAGNOSTIC_SAMPLE_COUNT;
      sampleIndex++
    ) {
      const offset = sampleIndex * 4;
      const gpuPageIndex = Math.round(samples[offset + 3]);
      if (gpuPageIndex === INVALID_DIAGNOSTIC_PAGE) continue;
      worldPosition.set(
        samples[offset],
        samples[offset + 1],
        samples[offset + 2],
      );
      const address = this.coordinates.computeAddress(
        worldPosition,
        sunDirection,
      );
      const cpuPageIndex =
        (address.pageY - MINIMUM_PAGE_COORDINATE) * PAGE_GRID_SIZE +
        address.pageX -
        MINIMUM_PAGE_COORDINATE;
      if (cpuPageIndex !== gpuPageIndex) mismatches++;
    }
    return mismatches;
  }
}
