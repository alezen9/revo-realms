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
const TENT_TAP_COUNT = 9;

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

type ClusterCaster = {
  bucket: VSMClusterBucket;
  rasterNode: ComputeNode;
};

const createDepthNode = (attribute: StorageBufferAttribute, count: number) =>
  storage(attribute, "uint", count).toAtomic();
const createPageJobsNode = (attribute: StorageBufferAttribute) =>
  storage(attribute, "uvec4", VSM_JOB_COUNT).toReadOnly();
const createTriangleCorners = () =>
  workgroupArray("vec3", VSM_CLUSTER_TRIANGLES * 3);
const createTriangleUvs = () =>
  workgroupArray("vec2", VSM_CLUSTER_TRIANGLES * 3);

type DepthNode = ReturnType<typeof createDepthNode>;
type PageJobsNode = ReturnType<typeof createPageJobsNode>;
type TriangleCorners = ReturnType<typeof createTriangleCorners>;
type TriangleUvs = ReturnType<typeof createTriangleUvs>;

type RasterArgs = [
  source: VSMClusterBucket,
  depth: DepthNode,
  triangleCorners: TriangleCorners,
  triangleUvs: TriangleUvs,
  lightBasis: VSMContext["lightBasis"],
  minimumY: Node<"float">,
  maximumY: Node<"float">,
  alphaTest: Node<"float">,
  opacityNode: Node<"float"> | undefined,
];

const getEdge = (from: Node<"vec2">, to: Node<"vec2">, point: Node<"vec2">) => {
  const edge = to.sub(from);
  const offset = point.sub(from);
  return edge.x.mul(offset.y).sub(edge.y.mul(offset.x));
};

const clearPages = Fn<
  [
    depth: DepthNode,
    pageJobs: PageJobsNode,
    jobCount: Node<"uint">,
    jobOffset: Node<"uint">,
  ],
  void
>(([depth, pageJobs, jobCount, jobOffset]) => {
  Loop(
    {
      start: workgroupId.x,
      end: jobCount,
      type: "uint",
      update: CLEAR_WORKGROUPS,
    },
    ({ i: jobLoopIndex }) => {
      const job = pageJobs.element(jobLoopIndex.add(jobOffset));
      const pageBase = job.y.mul(PAGE_TEXEL_COUNT).toVar();
      Loop(
        {
          start: localId.x,
          end: uint(PAGE_TEXEL_COUNT),
          type: "uint",
          update: CLEAR_WORKGROUP_SIZE,
        },
        ({ i: texel }) => {
          atomicStore(depth.element(pageBase.add(texel)), DEPTH_SCALE);
        },
      );
    },
  );
});

// opacityNode is only passed for alpha tested casters with uvs, so the opaque
// raster never reads uvs
const rasterizeClusters = Fn<RasterArgs, void>(
  ([
    source,
    depth,
    triangleCorners,
    triangleUvs,
    lightBasis,
    minimumY,
    maximumY,
    alphaTest,
    opacityNode,
  ]) => {
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
        const depthRange = maximumY.sub(minimumY);
        If(localId.x.lessThan(triangleCount), () => {
          Loop({ start: 0, end: 3, type: "uint" }, ({ i: corner }) => {
            const cornerIndex = localId.x.mul(3).add(corner).toVar();
            const vertex = work.firstVertex.add(cornerIndex).toVar();
            const casterCorner = source.getCorner(work, vertex).toVar();
            const world = casterCorner.xyz;
            const lightPosition = getLightPosition(world, lightBasis);
            const pagePosition = lightPosition.div(pageSize).sub(pageOrigin);
            const texel = pagePosition.mul(VSM_PAGE_TEXELS);
            const cornerHeight = world.y.sub(casterCorner.w);
            const cornerDepth = maximumY.sub(cornerHeight).div(depthRange);
            triangleCorners
              .element<"vec3">(cornerIndex)
              .assign(vec3(texel, cornerDepth));
            if (opacityNode)
              triangleUvs
                .element<"vec2">(cornerIndex)
                .assign(source.getUv(vertex));
          });
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
            const isPastPageStart = maximum.x
              .min(maximum.y)
              .greaterThanEqual(0);
            const isBeforePageEnd = minimum.x
              .max(minimum.y)
              .lessThan(VSM_PAGE_TEXELS);
            const hasArea = area.abs().greaterThan(1e-8);
            const isOnPage = isPastPageStart.and(isBeforePageEnd).and(hasArea);
            const firstTexel = uvec2(
              minimum.ceil().clamp(0, VSM_PAGE_TEXELS - 1),
            ).toVar();
            const lastTexel = uvec2(
              maximum.floor().clamp(0, VSM_PAGE_TEXELS - 1),
            ).toVar();
            const width = lastTexel.x.sub(firstTexel.x).add(1).toVar();
            const height = lastTexel.y.sub(firstTexel.y).add(1);
            const hasColumns = lastTexel.x.greaterThanEqual(firstTexel.x);
            const hasRows = lastTexel.y.greaterThanEqual(firstTexel.y);
            const hasTexels = isOnPage.and(hasColumns).and(hasRows);
            const texelCount = hasTexels.select(width.mul(height), uint(0));
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
                const smallestWeight = firstWeight
                  .min(secondWeight)
                  .min(thirdWeight);
                const isInside = smallestWeight.greaterThanEqual(0);
                let isCovered = isInside;
                if (opacityNode) {
                  const firstUv = triangleUvs.element<"vec2">(cornerBase);
                  const secondUv = triangleUvs.element<"vec2">(
                    cornerBase.add(1),
                  );
                  const thirdUv = triangleUvs.element<"vec2">(
                    cornerBase.add(2),
                  );
                  const texelUv = firstUv
                    .mul(firstWeight)
                    .add(secondUv.mul(secondWeight))
                    .add(thirdUv.mul(thirdWeight));
                  const opacity = opacityNode.context({
                    forceUVContext: true,
                    getUV: () => texelUv,
                  });
                  isCovered = isInside.and(opacity.greaterThanEqual(alphaTest));
                }
                If(isCovered, () => {
                  const weightedDepth = first.z
                    .mul(firstWeight)
                    .add(second.z.mul(secondWeight))
                    .add(third.z.mul(thirdWeight));
                  const texelDepth = weightedDepth.clamp(0, 1);
                  const depthIndex = pageBase
                    .add(y.mul(VSM_PAGE_TEXELS))
                    .add(x);
                  const storedDepth = uint(texelDepth.mul(DEPTH_SCALE));
                  atomicMin(depth.element(depthIndex), storedDepth);
                });
              },
            );
          },
        );
        workgroupBarrier();
      },
    );
  },
);

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
  private clearNode;
  private clusterCasters = new Map<string, ClusterCaster>();

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
    this.depthNode = createDepthNode(depthAttribute, texelCount);
    this.readDepthNode = storage(
      depthAttribute,
      "uint",
      texelCount,
    ).toReadOnly();
    const jobCounts = storage(
      jobs.countAttribute,
      "uint",
      jobs.countLength,
    ).toReadOnly();

    this.clearNode = clearPages(
      this.depthNode,
      createPageJobsNode(context.pageJobs),
      jobCounts.element(jobs.countIndex),
      uint(jobs.offset),
    ).compute(CLEAR_WORKGROUPS * CLEAR_WORKGROUP_SIZE, [CLEAR_WORKGROUP_SIZE]);
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

  collectComputeNodes(nodes: ComputeNode[]) {
    this.collectBoundsNodes(nodes);
    this.collectRasterNodes(nodes);
  }

  collectBoundsNodes(nodes: ComputeNode[]) {
    for (const { bucket } of this.clusterCasters.values())
      bucket.collectBoundsNodes(nodes);
  }

  collectRasterNodes(nodes: ComputeNode[]) {
    nodes.push(this.clearNode);
    for (const { bucket, rasterNode } of this.clusterCasters.values()) {
      bucket.collectWorkNodes(nodes);
      nodes.push(rasterNode);
    }
    this.isReady.value = 1;
  }

  loadDepth(slot: Node<"uint">, texel: Node<"uvec2">) {
    const pageBase = slot.mul(PAGE_TEXEL_COUNT);
    const depthIndex = pageBase.add(texel.y.mul(VSM_PAGE_TEXELS)).add(texel.x);
    const storedDepth = float(this.readDepthNode.element(depthIndex));
    return storedDepth.div(DEPTH_SCALE);
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
    const topLeft = this.getLit(slot, uvec2(first.x, first.y), receiverDepth);
    const topRight = this.getLit(slot, uvec2(last.x, first.y), receiverDepth);
    const bottomLeft = this.getLit(slot, uvec2(first.x, last.y), receiverDepth);
    const bottomRight = this.getLit(slot, uvec2(last.x, last.y), receiverDepth);
    const top = mix(topLeft, topRight, weight.x);
    const bottom = mix(bottomLeft, bottomRight, weight.x);
    return mix(top, bottom, weight.y);
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
    for (let tap = 0; tap < TENT_TAP_COUNT; tap++) {
      const column = tap % 3;
      const row = Math.floor(tap / 3);
      const texel = base.add(uvec2(column, row));
      const texelCenter = vec2(texel).add(0.5).div(VSM_PAGE_TEXELS);
      const pageOffset = texelCenter.sub(pageUv);
      const tapDepth = receiverDepth.add(receiverDepthSlope.dot(pageOffset));
      const tapWeight = weightsX[column].mul(weightsY[row]);
      const tapVisibility = this.getLit(slot, texel, tapDepth);
      visibility = visibility.add(tapVisibility.mul(tapWeight));
    }
    return visibility;
  }

  private getLit(
    slot: Node<"uint">,
    texel: Node<"uvec2">,
    receiverDepth: Node<"float">,
  ) {
    const storedDepth = this.loadDepth(slot, texel);
    return float(receiverDepth.lessThanEqual(storedDepth));
  }

  private rebuildClusterCasters() {
    const groups = new Map<string, VSMCaster[]>();
    for (const caster of this.context.casters) {
      if (caster.type !== this.kind) continue;
      let key = "opaque";
      if (caster.opacityNode || caster.positionNode) key = caster.mesh.uuid;
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
      if (clusterCaster) {
        const hasKeptBucket = clusterCaster.bucket.setCasters(casters);
        if (hasKeptBucket) continue;
        clusterCaster.rasterNode.dispose();
        clusterCaster.bucket.dispose();
      }
      const [{ opacityNode, alphaTest }] = casters;
      const hasOpacity = !!opacityNode;
      const bucket = new VSMClusterBucket(
        this.context,
        this.jobs,
        casters,
        hasOpacity,
        this.kind,
      );
      let rasterOpacityNode: Node<"float"> | undefined;
      if (bucket.hasUvs) rasterOpacityNode = opacityNode;
      const rasterNode = rasterizeClusters(
        bucket,
        this.depthNode,
        createTriangleCorners(),
        createTriangleUvs(),
        this.context.lightBasis,
        this.minimumY,
        this.maximumY,
        float(alphaTest),
        rasterOpacityNode,
      ).compute(RASTER_WORKGROUPS * VSM_CLUSTER_TRIANGLES, [
        VSM_CLUSTER_TRIANGLES,
      ]);
      rasterNode.name = `VSM ${this.kind} raster`;
      this.clusterCasters.set(key, { bucket, rasterNode });
    }
  }
}
