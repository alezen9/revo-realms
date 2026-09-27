import {
  StorageBufferAttribute,
  type ComputeNode,
  type Node,
} from "three/webgpu";
import {
  atomicMin,
  atomicStore,
  float,
  Fn,
  If,
  localId,
  Loop,
  mix,
  storage,
  uint,
  uniform,
  uvec2,
  vec2,
  vec3,
  workgroupArray,
  workgroupBarrier,
  workgroupId,
} from "three/tsl";
import { VSM_CLUSTER_TRIANGLES, VSMClusterBucket } from "./VSMClusterBucket";
import {
  VSM_JOB_COUNT,
  type VSMCaster,
  type VSMContext,
  type VSMJobSource,
  type VSMLayerKind,
} from "./VSMContext";
import {
  VSM_PAGE_OFFSET,
  VSM_PAGE_TEXELS,
  getLightPosition,
  getPageSize,
} from "./VSMMath";

const PAGE_TEXEL_COUNT = VSM_PAGE_TEXELS * VSM_PAGE_TEXELS;
const DEPTH_SCALE = 16777215;
const CLEAR_WORKGROUP_SIZE = 256;
const CLEAR_WORKGROUPS = 128;
const RASTER_WORKGROUPS = 512;

type VSMDepthPoolOptions = {
  kind: VSMLayerKind;
  capacity: number;
  jobs: VSMJobSource;
  depthBiasTexels: number;
};

export type VSMRasterWork = {
  slot: Node<"uint">;
  level: Node<"uint">;
  pageCoordinate: Node<"uvec2">;
  firstVertex: Node<"uint">;
  triangleCount: Node<"uint">;
  instance: Node<"uint">;
};

export type VSMRasterSource = {
  readonly hasUvs: boolean;
  getWorkCount: () => Node<"uint">;
  getWork: (index: Node<"uint">) => VSMRasterWork;
  getCorner: (work: VSMRasterWork, vertex: Node<"uint">) => Node<"vec4">;
  getUv: (vertex: Node<"uint">) => Node<"vec2">;
};

export type VSMRasterCaster = {
  source: VSMRasterSource;
  alphaTest: number;
  opacity?: (uv: Node<"vec2">) => Node<"float">;
};

type ClusterCaster = {
  bucket: VSMClusterBucket;
  rasterNode: ComputeNode;
};

const getEdge = (from: Node<"vec2">, to: Node<"vec2">, point: Node<"vec2">) =>
  to.x
    .sub(from.x)
    .mul(point.y.sub(from.y))
    .sub(to.y.sub(from.y).mul(point.x.sub(from.x)));

export class VSMDepthPool {
  readonly minimumY = uniform(-8);
  readonly maximumY = uniform(64);
  readonly isReady = uniform(0);
  readonly depthBiasTexels: number;
  private context: VSMContext;
  private kind: VSMDepthPoolOptions["kind"];
  private jobs: VSMJobSource;
  private depthNode;
  private readDepthNode;
  private pageJobsNode;
  private jobCountNode;
  private clearNode;
  private clusterCasters = new Map<string, ClusterCaster>();
  private instanceRasterNodes: ComputeNode[] = [];

  constructor(context: VSMContext, options: VSMDepthPoolOptions) {
    const { kind, capacity, jobs, depthBiasTexels } = options;
    this.context = context;
    this.kind = kind;
    this.jobs = jobs;
    this.depthBiasTexels = depthBiasTexels;
    const texelCount = capacity * PAGE_TEXEL_COUNT;
    const depthAttribute = new StorageBufferAttribute(
      new Uint32Array(texelCount),
      1,
    );
    this.depthNode = storage(depthAttribute, "uint", texelCount).toAtomic();
    this.readDepthNode = storage(
      depthAttribute,
      "uint",
      texelCount,
    ).toReadOnly();
    this.pageJobsNode = storage(
      context.pageJobs,
      "uvec4",
      VSM_JOB_COUNT,
    ).toReadOnly();
    this.jobCountNode = storage(
      jobs.countAttribute,
      "uint",
      jobs.countLength,
    ).toReadOnly();

    this.clearNode = Fn(() => {
      Loop(
        {
          start: workgroupId.x,
          end: this.jobCountNode.element(jobs.countIndex),
          type: "uint",
          update: CLEAR_WORKGROUPS,
        },
        ({ i: jobLoopIndex }) => {
          const pageBase = this.pageJobsNode
            .element(jobLoopIndex.add(jobs.offset))
            .y.mul(PAGE_TEXEL_COUNT)
            .toVar();
          Loop(
            {
              start: localId.x,
              end: uint(PAGE_TEXEL_COUNT),
              type: "uint",
              update: CLEAR_WORKGROUP_SIZE,
            },
            ({ i: texel }) => {
              atomicStore(
                this.depthNode.element(pageBase.add(texel)),
                DEPTH_SCALE,
              );
            },
          );
        },
      );
    })().compute(CLEAR_WORKGROUPS * CLEAR_WORKGROUP_SIZE, [
      CLEAR_WORKGROUP_SIZE,
    ]);
    this.clearNode.name = `VSM ${kind} clear`;
  }

  sync(terrainBounds: { min: number; max: number }) {
    const { changes } = this.context;
    const { hasRosterChanged, hasCasterMoved } = changes[this.kind];
    const hasMatrixChange = hasRosterChanged || hasCasterMoved;
    if (!hasMatrixChange && !changes.hasSunChanged) return;

    if (hasRosterChanged) this.rebuildClusterCasters();
    let minimumY = terrainBounds.min - 8;
    let maximumY = terrainBounds.max + 64;
    for (const { bucket } of this.clusterCasters.values()) {
      if (hasMatrixChange) bucket.updateMatrices();
      else bucket.invalidateBounds();
      minimumY = Math.min(minimumY, bucket.bounds.min.y);
      maximumY = Math.max(maximumY, bucket.bounds.max.y);
    }
    const hasDepthRangeChange =
      this.minimumY.value !== Math.floor(minimumY) ||
      this.maximumY.value !== Math.ceil(maximumY);
    this.minimumY.value = Math.floor(minimumY);
    this.maximumY.value = Math.ceil(maximumY);
    if (this.kind === "static" && hasDepthRangeChange)
      this.context.invalidateAllPages();
  }

  getComputeNodes() {
    const nodes = [this.clearNode];
    for (const { bucket, rasterNode } of this.clusterCasters.values())
      nodes.push(...bucket.takeComputeNodes(), rasterNode);
    nodes.push(...this.instanceRasterNodes);
    this.isReady.value = 1;
    return nodes;
  }

  setInstanceCasters(casters: VSMRasterCaster[]) {
    for (const rasterNode of this.instanceRasterNodes) rasterNode.dispose();
    this.instanceRasterNodes = [];
    for (const { source, alphaTest, opacity } of casters)
      this.instanceRasterNodes.push(
        this.createRasterNode(source, alphaTest, opacity),
      );
  }

  loadDepth(slot: Node<"uint">, texel: Node<"uvec2">) {
    return float(
      this.readDepthNode.element(
        slot
          .mul(PAGE_TEXEL_COUNT)
          .add(texel.y.mul(VSM_PAGE_TEXELS))
          .add(texel.x),
      ),
    ).div(DEPTH_SCALE);
  }

  compareDepth(
    slot: Node<"uint">,
    pageUv: Node<"vec2">,
    receiverDepth: Node<"float">,
  ) {
    const position = pageUv.mul(VSM_PAGE_TEXELS).sub(0.5);
    const origin = position.floor();
    const weight = position.sub(origin);
    const first = uvec2(origin.clamp(0, VSM_PAGE_TEXELS - 1));
    const last = uvec2(origin.add(1).clamp(0, VSM_PAGE_TEXELS - 1));
    return mix(
      mix(
        this.getLit(slot, uvec2(first.x, first.y), receiverDepth),
        this.getLit(slot, uvec2(last.x, first.y), receiverDepth),
        weight.x,
      ),
      mix(
        this.getLit(slot, uvec2(first.x, last.y), receiverDepth),
        this.getLit(slot, uvec2(last.x, last.y), receiverDepth),
        weight.x,
      ),
      weight.y,
    );
  }

  compareDepthTent(
    slot: Node<"uint">,
    pageUv: Node<"vec2">,
    receiverDepth: Node<"float">,
    receiverDepthSlope: Node<"vec2">,
  ) {
    const position = pageUv.mul(VSM_PAGE_TEXELS).sub(1);
    const origin = position.floor();
    const fraction = position.sub(origin);
    const base = uvec2(origin);
    const weightsX = [
      float(1).sub(fraction.x).mul(0.5),
      float(0.5),
      fraction.x.mul(0.5),
    ];
    const weightsY = [
      float(1).sub(fraction.y).mul(0.5),
      float(0.5),
      fraction.y.mul(0.5),
    ];
    let visibility: Node<"float"> = float(0);
    for (let row = 0; row < 3; row++) {
      let rowVisibility: Node<"float"> = float(0);
      for (let column = 0; column < 3; column++) {
        const texel = base.add(uvec2(column, row));
        const pageOffset = vec2(texel)
          .add(0.5)
          .div(VSM_PAGE_TEXELS)
          .sub(pageUv);
        rowVisibility = rowVisibility.add(
          this.getLit(
            slot,
            texel,
            receiverDepth.add(receiverDepthSlope.dot(pageOffset)),
          ).mul(weightsX[column]),
        );
      }
      visibility = visibility.add(rowVisibility.mul(weightsY[row]));
    }
    return visibility;
  }

  private getLit(
    slot: Node<"uint">,
    texel: Node<"uvec2">,
    receiverDepth: Node<"float">,
  ) {
    return receiverDepth
      .lessThanEqual(this.loadDepth(slot, texel))
      .select(float(1), float(0));
  }

  private rebuildClusterCasters() {
    const groups = new Map<string, VSMCaster[]>([["opaque", []]]);
    for (const caster of this.context.casters) {
      if (caster.kind !== this.kind) continue;
      const key = caster.opacity ? caster.mesh.uuid : "opaque";
      const casters = groups.get(key);
      if (casters) casters.push(caster);
      else groups.set(key, [caster]);
    }
    for (const [key, clusterCaster] of this.clusterCasters) {
      if (groups.has(key)) continue;
      clusterCaster.rasterNode.dispose();
      clusterCaster.bucket.dispose();
      this.clusterCasters.delete(key);
    }
    for (const [key, casters] of groups) {
      const clusterCaster = this.clusterCasters.get(key);
      if (clusterCaster?.bucket.setCasters(casters)) continue;
      clusterCaster?.rasterNode.dispose();
      clusterCaster?.bucket.dispose();
      const { opacity, alphaTest } = casters[0] ?? { alphaTest: 0 };
      const bucket = new VSMClusterBucket(
        this.context,
        this.jobs,
        casters,
        opacity !== undefined,
      );
      const rasterNode = this.createRasterNode(bucket, alphaTest, opacity);
      this.clusterCasters.set(key, { bucket, rasterNode });
    }
  }

  private createRasterNode(
    source: VSMRasterSource,
    alphaTest: number,
    opacity?: (uv: Node<"vec2">) => Node<"float">,
  ) {
    const { lightBasis } = this.context;
    const { minimumY, maximumY } = this;
    const hasOpacity = source.hasUvs && opacity !== undefined;
    const triangleCorners = workgroupArray("vec3", VSM_CLUSTER_TRIANGLES * 3);
    const triangleUvs = workgroupArray("vec2", VSM_CLUSTER_TRIANGLES * 3);

    const rasterNode = Fn(() => {
      Loop(
        {
          start: workgroupId.x,
          end: source.getWorkCount(),
          type: "uint",
          update: RASTER_WORKGROUPS,
        },
        ({ i: itemLoopIndex }) => {
          const work = source.getWork(itemLoopIndex.toVar());
          const triangleCount = work.triangleCount.toVar();
          const pageSize = getPageSize(work.level).toVar();
          const pageOrigin = vec2(work.pageCoordinate)
            .sub(VSM_PAGE_OFFSET)
            .toVar();
          If(localId.x.lessThan(triangleCount), () => {
            for (let corner = 0; corner < 3; corner++) {
              const vertex = work.firstVertex
                .add(localId.x.mul(3))
                .add(corner)
                .toVar();
              const casterCorner = source.getCorner(work, vertex).toVar();
              const world = casterCorner.xyz;
              const texel = getLightPosition(world, lightBasis)
                .div(pageSize)
                .sub(pageOrigin)
                .mul(VSM_PAGE_TEXELS);
              const depth = maximumY
                .sub(world.y)
                .add(casterCorner.w)
                .div(maximumY.sub(minimumY));
              const cornerIndex = localId.x.mul(3).add(corner);
              triangleCorners
                .element<"vec3">(cornerIndex)
                .assign(vec3(texel, depth));
              if (hasOpacity)
                triangleUvs
                  .element<"vec2">(cornerIndex)
                  .assign(source.getUv(vertex));
            }
          });
          workgroupBarrier();
          const pageBase = work.slot.mul(PAGE_TEXEL_COUNT).toVar();
          Loop(
            { start: uint(0), end: triangleCount, type: "uint" },
            ({ i: triangleLoopIndex }) => {
              const cornerBase = triangleLoopIndex.mul(3).toVar();
              const first = triangleCorners.element<"vec3">(cornerBase).toVar();
              const second = triangleCorners
                .element<"vec3">(cornerBase.add(1))
                .toVar();
              const third = triangleCorners
                .element<"vec3">(cornerBase.add(2))
                .toVar();
              const area = getEdge(first.xy, second.xy, third.xy).toVar();
              const minimum = first.xy.min(second.xy).min(third.xy).sub(0.5);
              const maximum = first.xy.max(second.xy).max(third.xy).sub(0.5);
              const isOnPage = maximum.x
                .greaterThanEqual(0)
                .and(maximum.y.greaterThanEqual(0))
                .and(minimum.x.lessThan(VSM_PAGE_TEXELS))
                .and(minimum.y.lessThan(VSM_PAGE_TEXELS))
                .and(area.abs().greaterThan(1e-8));
              const firstTexel = uvec2(
                minimum.ceil().clamp(0, VSM_PAGE_TEXELS - 1),
              ).toVar();
              const lastTexel = uvec2(
                maximum.floor().clamp(0, VSM_PAGE_TEXELS - 1),
              ).toVar();
              const width = lastTexel.x.sub(firstTexel.x).add(1).toVar();
              const texelCount = isOnPage
                .and(lastTexel.x.greaterThanEqual(firstTexel.x))
                .and(lastTexel.y.greaterThanEqual(firstTexel.y))
                .select(
                  width.mul(lastTexel.y.sub(firstTexel.y).add(1)),
                  uint(0),
                );
              Loop(
                {
                  start: localId.x,
                  end: texelCount,
                  type: "uint",
                  update: VSM_CLUSTER_TRIANGLES,
                },
                ({ i: texelIndex }) => {
                  const x = firstTexel.x.add(texelIndex.mod(width)).toVar();
                  const y = firstTexel.y.add(texelIndex.div(width)).toVar();
                  const center = vec2(x, y).add(0.5);
                  const firstWeight = getEdge(second.xy, third.xy, center)
                    .div(area)
                    .toVar();
                  const secondWeight = getEdge(third.xy, first.xy, center)
                    .div(area)
                    .toVar();
                  const thirdWeight = getEdge(first.xy, second.xy, center)
                    .div(area)
                    .toVar();
                  const isInside = firstWeight
                    .greaterThanEqual(0)
                    .and(secondWeight.greaterThanEqual(0))
                    .and(thirdWeight.greaterThanEqual(0));
                  const isOpaque =
                    hasOpacity && opacity
                      ? opacity(
                          triangleUvs
                            .element<"vec2">(cornerBase)
                            .mul(firstWeight)
                            .add(
                              triangleUvs
                                .element<"vec2">(cornerBase.add(1))
                                .mul(secondWeight),
                            )
                            .add(
                              triangleUvs
                                .element<"vec2">(cornerBase.add(2))
                                .mul(thirdWeight),
                            ),
                        ).greaterThanEqual(alphaTest)
                      : isInside;
                  If(isInside.and(isOpaque), () => {
                    const depth = first.z
                      .mul(firstWeight)
                      .add(second.z.mul(secondWeight))
                      .add(third.z.mul(thirdWeight))
                      .clamp(0, 1);
                    atomicMin(
                      this.depthNode.element(
                        pageBase.add(y.mul(VSM_PAGE_TEXELS)).add(x),
                      ),
                      uint(depth.mul(DEPTH_SCALE)),
                    );
                  });
                },
              );
            },
          );
          workgroupBarrier();
        },
      );
    })().compute(RASTER_WORKGROUPS * VSM_CLUSTER_TRIANGLES, [
      VSM_CLUSTER_TRIANGLES,
    ]);
    rasterNode.name = `VSM ${this.kind} raster`;
    return rasterNode;
  }
}
