import {
  Box3,
  BufferAttribute,
  MathUtils,
  Matrix4,
  Vector3,
  type BufferGeometry,
  type Mesh,
} from "three";
import { MeshoptClusterizer } from "meshoptimizer/clusterizer";
import { BatchedMesh, StorageBufferAttribute } from "three/webgpu";
import type { ComputeNode, Node, StorageBufferNode } from "three/webgpu";
import {
  atomicAdd,
  atomicStore,
  bool,
  float,
  Fn,
  If,
  instanceIndex,
  Loop,
  positionGeometry,
  positionLocal,
  storage,
  uint,
  uvec2,
  uvec4,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { VSMRasterWork } from "./VSMDepthPool";
import {
  VSM_LEVEL_COUNT,
  VSM_PAGES_PER_LEVEL,
  getLightPosition,
  getPageCoordinate,
  getPageKey,
  getPageSize,
  getWindowCenter,
  isPageInWindow,
} from "./VSMMath";
import {
  VSM_JOB_COUNT,
  type VSMCaster,
  type VSMContext,
  type VSMJobSource,
  type VSMLayerKind,
} from "./VSMContext";

export const VSM_CLUSTER_TRIANGLES = 64;
const VSM_CLUSTER_VERTICES = VSM_CLUSTER_TRIANGLES * 3;
const VSM_CLUSTER_MAX_WORK_ITEMS = 262144;
const VSM_MASK_SIZE = 1024;
const VSM_MASK_WORDS = (VSM_MASK_SIZE * VSM_MASK_SIZE) / 32;
// 12 bits per uv axis keep the packed uv an exact integer in a float
const UV_STEPS = 4096;
const UV_LAST_STEP = UV_STEPS - 1;

type ClusterInstance = {
  mesh: Mesh;
  caster: VSMCaster;
  batchInstanceId?: number;
  firstCluster: number;
  clusterCount: number;
  maskId: number;
};

type ClusterGeometry = {
  firstCluster: number;
  clusterCount: number;
};

type MaskSource = {
  opacityNode: Node<"float">;
  alphaTest: number;
};

type ClusterContent = {
  instances: ClusterInstance[];
  positions: number[];
  clusterBounds: number[];
  instanceClusters: number[];
  maskSources: MaskSource[];
};

export const buildClusterMeshlets = (
  geometry: BufferGeometry,
  range: { start: number; count: number },
) => {
  const position = geometry.getAttribute("position");
  if (!(position instanceof BufferAttribute))
    throw new Error("Cluster positions can't be interleaved");
  const { array, itemSize } = position;
  if (!(array instanceof Float32Array))
    throw new Error("Cluster positions must be floats");
  const { index } = geometry;
  const triangleCount = Math.floor(range.count / 3);
  const indices = new Uint32Array(triangleCount * 3);
  for (let element = 0; element < indices.length; element++) {
    let vertexIndex = range.start + element;
    if (index) vertexIndex = index.getX(vertexIndex);
    indices[element] = vertexIndex;
  }
  return MeshoptClusterizer.buildMeshletsSpatial(
    indices,
    array,
    itemSize,
    VSM_CLUSTER_VERTICES,
    VSM_CLUSTER_TRIANGLES,
    VSM_CLUSTER_TRIANGLES,
  );
};

const appendGeometryClusters = (
  geometry: BufferGeometry,
  range: { start: number; count: number },
  positions: number[],
  clusterBounds: number[],
  clusterTriangles: number[],
): ClusterGeometry => {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const firstCluster = clusterBounds.length / 8;
  const meshlets = buildClusterMeshlets(geometry, range);
  const minimum = new Vector3();
  const maximum = new Vector3();
  const vertex = new Vector3();
  for (let cluster = 0; cluster < meshlets.meshletCount; cluster++) {
    const { vertices, triangles } = MeshoptClusterizer.extractMeshlet(
      meshlets,
      cluster,
    );
    const lastTriangleCorner = triangles.length - 3;
    minimum.setScalar(Infinity);
    maximum.setScalar(-Infinity);
    for (let corner = 0; corner < VSM_CLUSTER_VERTICES; corner++) {
      const isPadding = corner >= triangles.length;
      // padding repeats the last triangle's first corner, a zero area triangle
      let meshletCorner = corner;
      if (isPadding) meshletCorner = lastTriangleCorner;
      const vertexIndex = vertices[triangles[meshletCorner]];
      vertex.fromBufferAttribute(position, vertexIndex);
      let packedUv = 0;
      if (uv) {
        const u = MathUtils.clamp(uv.getX(vertexIndex), 0, 1);
        const v = MathUtils.clamp(uv.getY(vertexIndex), 0, 1);
        const packedU = Math.round(u * UV_LAST_STEP);
        const packedV = Math.round(v * UV_LAST_STEP);
        packedUv = packedU + packedV * UV_STEPS;
      }
      positions.push(vertex.x, vertex.y, vertex.z, packedUv);
      minimum.min(vertex);
      maximum.max(vertex);
    }
    clusterTriangles.push(triangles.length / 3);
    clusterBounds.push(
      minimum.x,
      minimum.y,
      minimum.z,
      0,
      maximum.x,
      maximum.y,
      maximum.z,
      0,
    );
  }
  return { firstCluster, clusterCount: meshlets.meshletCount };
};

const getInstanceBatchIds = (caster: VSMCaster) => {
  const { mesh, positionNode } = caster;
  const batchIds: (number | undefined)[] = [];
  if (mesh instanceof BatchedMesh) {
    for (let id = 0; id < mesh.instanceCount; id++)
      if (mesh.getVisibleAt(id)) batchIds.push(id);
    return batchIds;
  }
  let instanceCount = 1;
  if (positionNode) instanceCount = mesh.count;
  for (let instance = 0; instance < instanceCount; instance++)
    batchIds.push(undefined);
  return batchIds;
};

const getCapacity = (length: number) =>
  2 ** Math.ceil(Math.log2(Math.max(length, 1)));

const createVec4Node = (attribute: StorageBufferAttribute, count: number) =>
  storage(attribute, "vec4", count);
const createUvec4Node = (attribute: StorageBufferAttribute, count: number) =>
  storage(attribute, "uvec4", count);
const createWorkItemsNode = (attribute: StorageBufferAttribute) =>
  storage(attribute, "uvec2", VSM_CLUSTER_MAX_WORK_ITEMS);
const createWorkCounterNode = (attribute: StorageBufferAttribute) =>
  storage(attribute, "uint", 1).toAtomic();
const createMasksNode = (attribute: StorageBufferAttribute) =>
  storage(attribute, "uint", attribute.count);

type Vec4Node = ReturnType<typeof createVec4Node>;
type Uvec4Node = ReturnType<typeof createUvec4Node>;
type WorkItemsNode = ReturnType<typeof createWorkItemsNode>;
type WorkCounterNode = ReturnType<typeof createWorkCounterNode>;
type MasksNode = ReturnType<typeof createMasksNode>;

const getWorldPosition = (
  matrices: StorageBufferNode<"vec4">,
  instance: Node<"uint">,
  local: Node<"vec3">,
  positionNode: Node<"vec3"> | undefined,
) => {
  let position = local;
  if (positionNode)
    position = positionNode.context({
      overrideNodes: new Map<Node, () => Node>([
        [instanceIndex, () => instance],
        [positionLocal, () => local],
        [positionGeometry, () => local],
      ]),
    });
  const matrixOffset = instance.mul(4);
  const columnX = matrices.element(matrixOffset);
  const columnY = matrices.element(matrixOffset.add(1));
  const columnZ = matrices.element(matrixOffset.add(2));
  const translation = matrices.element(matrixOffset.add(3));
  const world = columnX
    .mul(position.x)
    .add(columnY.mul(position.y))
    .add(columnZ.mul(position.z))
    .add(translation);
  return world.xyz;
};

const computeClusterLightBounds = Fn<
  [
    instanceClusters: Uvec4Node,
    clusterBounds: Vec4Node,
    positions: Vec4Node,
    matrices: Vec4Node,
    lightBounds: Vec4Node,
    lightBasis: VSMContext["lightBasis"],
    positionNode: Node<"vec3"> | undefined,
  ],
  void
>(
  ([
    instanceClusters,
    clusterBounds,
    positions,
    matrices,
    lightBounds,
    lightBasis,
    positionNode,
  ]) => {
    const instanceCluster = instanceClusters.element(instanceIndex).toVar();
    const bounds = vec4(1e8, 1e8, -1e8, -1e8).toVar();
    // a position node can deform the cluster, so its rest box corners don't bound it
    if (positionNode) {
      const vertexCount = instanceCluster.w.mul(3);
      Loop({ start: 0, end: vertexCount, type: "uint" }, ({ i: vertex }) => {
        const positionIndex = instanceCluster.y.add(vertex);
        const local = positions.element(positionIndex).xyz.toVar();
        const world = getWorldPosition(
          matrices,
          instanceCluster.x,
          local,
          positionNode,
        );
        const light = getLightPosition(world, lightBasis);
        bounds.assign(vec4(bounds.xy.min(light), bounds.zw.max(light)));
      });
      lightBounds.element(instanceIndex).assign(bounds);
      return;
    }
    const boundsIndex = instanceCluster.z.mul(2);
    const minimum = clusterBounds.element(boundsIndex).xyz.toVar();
    const maximum = clusterBounds.element(boundsIndex.add(1)).xyz.toVar();
    const size = maximum.sub(minimum).toVar();
    Loop({ start: 0, end: 8, type: "uint" }, ({ i: corner }) => {
      const cornerSide = vec3(
        corner.bitAnd(1),
        corner.shiftRight(1).bitAnd(1),
        corner.shiftRight(2).bitAnd(1),
      );
      const local = size.mul(cornerSide).add(minimum).toVar();
      const world = getWorldPosition(
        matrices,
        instanceCluster.x,
        local,
        positionNode,
      );
      const light = getLightPosition(world, lightBasis);
      bounds.assign(vec4(bounds.xy.min(light), bounds.zw.max(light)));
    });
    lightBounds.element(instanceIndex).assign(bounds);
  },
);

// opacity is baked once, so it may only depend on uv
const bakeOpacityMask = Fn<
  [
    masks: MasksNode,
    maskBase: Node<"uint">,
    opacityNode: Node<"float">,
    alphaTest: Node<"float">,
  ],
  void
>(([masks, maskBase, opacityNode, alphaTest]) => {
  const firstTexel = instanceIndex.mul(32).toVar();
  const word = uint(0).toVar();
  Loop({ start: 0, end: 32, type: "uint" }, ({ i: bit }) => {
    const texel = firstTexel.add(bit);
    const texelCoordinate = vec2(
      texel.mod(VSM_MASK_SIZE),
      texel.div(VSM_MASK_SIZE),
    );
    const texelUv = texelCoordinate.add(0.5).div(VSM_MASK_SIZE);
    const opacity = opacityNode.context({
      forceUVContext: true,
      getUV: () => texelUv,
    });
    const isSolid = opacity.greaterThanEqual(alphaTest);
    const solidBit = isSolid.select(uint(1), uint(0)).shiftLeft(bit);
    word.assign(word.bitOr(solidBit));
  });
  masks.element(maskBase.add(instanceIndex)).assign(word);
});

const resetWorkCount = Fn<[workCounter: WorkCounterNode], void>(
  ([workCounter]) => {
    atomicStore(workCounter.element(0), 0);
  },
);

const collectClusterWork = Fn<
  [
    lightBounds: Vec4Node,
    pageJobs: Uvec4Node,
    jobCount: Node<"uint">,
    jobOffset: Node<"uint">,
    workCounter: WorkCounterNode,
    workItems: WorkItemsNode,
  ],
  void
>(([lightBounds, pageJobs, jobCount, jobOffset, workCounter, workItems]) => {
  const bounds = lightBounds.element(instanceIndex).toVar();
  const jobTotal = jobCount.toVar();
  Loop({ start: 0, end: jobTotal, type: "uint" }, ({ i: jobLoopIndex }) => {
    const jobIndex = jobLoopIndex.toVar();
    const job = pageJobs.element(jobIndex.add(jobOffset));
    const pageSize = getPageSize(job.x.div(VSM_PAGES_PER_LEVEL));
    const firstPage = getPageCoordinate(bounds.xy.div(pageSize));
    const lastPage = getPageCoordinate(bounds.zw.div(pageSize));
    const isPastFirstPage = job.z
      .greaterThanEqual(firstPage.x)
      .and(job.w.greaterThanEqual(firstPage.y));
    const isBeforeLastPage = job.z
      .lessThanEqual(lastPage.x)
      .and(job.w.lessThanEqual(lastPage.y));
    const hasPageOverlap = isPastFirstPage.and(isBeforeLastPage);
    If(hasPageOverlap, () => {
      const itemIndex = atomicAdd(workCounter.element(0), 1);
      If(itemIndex.lessThan(VSM_CLUSTER_MAX_WORK_ITEMS), () => {
        workItems.element(itemIndex).assign(uvec2(jobIndex, instanceIndex));
      });
    });
  });
});

// stamps the active pages this cluster covers, read by the dynamic touch pass
const markClusterPages = Fn<
  [
    lightBounds: Vec4Node,
    pageTable: Uvec4Node,
    frame: Node<"uint">,
    cameraPosition: Node<"vec3">,
    lightBasis: VSMContext["lightBasis"],
  ],
  void
>(([lightBounds, pageTable, frame, cameraPosition, lightBasis]) => {
  const bounds = lightBounds.element(instanceIndex).toVar();
  Loop(
    { start: 0, end: VSM_LEVEL_COUNT, type: "uint" },
    ({ i: levelIndex }) => {
      const level = levelIndex.toVar();
      const pageSize = getPageSize(level);
      const firstPage = getPageCoordinate(bounds.xy.div(pageSize)).toVar();
      const lastPage = getPageCoordinate(bounds.zw.div(pageSize)).toVar();
      const windowCenter = getWindowCenter(
        cameraPosition,
        lightBasis,
        level,
      ).toVar();
      const pageWidth = lastPage.x.sub(firstPage.x).add(1).toVar();
      const pageHeight = lastPage.y.sub(firstPage.y).add(1);
      const pageCount = pageWidth.mul(pageHeight);
      Loop(
        { start: 0, end: pageCount, type: "uint" },
        ({ i: pageLoopIndex }) => {
          const pageIndex = pageLoopIndex.toVar();
          const pageCoordinate = firstPage.add(
            uvec2(pageIndex.mod(pageWidth), pageIndex.div(pageWidth)),
          );
          const pageKey = getPageKey(level, pageCoordinate);
          const pageTableEntry = pageTable.element(pageKey);
          const isInWindow = isPageInWindow(pageCoordinate, windowCenter);
          const isActivePage = pageTableEntry.w.equal(frame);
          If(isInWindow.and(isActivePage), () => {
            const { x, z, w } = pageTableEntry;
            pageTableEntry.assign(uvec4(x, frame, z, w));
          });
        },
      );
    },
  );
});

export class VSMClusterBucket {
  readonly positionsAttribute: StorageBufferAttribute;
  readonly matricesAttribute: StorageBufferAttribute;
  readonly instanceClustersAttribute: StorageBufferAttribute;
  readonly workCountAttribute = new StorageBufferAttribute(
    new Uint32Array(1),
    1,
  );
  readonly workItemsAttribute = new StorageBufferAttribute(
    new Uint32Array(VSM_CLUSTER_MAX_WORK_ITEMS * 2),
    2,
  );
  readonly bounds = new Box3();
  readonly hasMasks: boolean;
  private jobs: VSMJobSource;
  private instances: ClusterInstance[] = [];
  private maskSources: MaskSource[];
  private positionValues: Float32Array;
  private matrixValues: Float32Array;
  private instanceClusterValues: Uint32Array;
  private clusterBoundValues: Float32Array;
  private clusterBoundsAttribute: StorageBufferAttribute;
  private hasDirtyBounds = true;
  private boundsNode;
  private resetNode;
  private buildNode;
  private markNode?: ComputeNode;
  private rasterJobs;
  private rasterWorkCount;
  private rasterWorkItems;
  private rasterInstanceClusters;
  private rasterPositions;
  private rasterMatrices;
  private rasterMasks?: StorageBufferNode<"uint">;
  private bakeNodes: ComputeNode[] = [];
  private hasPendingBake = true;
  private batchMatrix = new Matrix4();
  private worldMatrix = new Matrix4();
  private instanceBounds = new Box3();
  private readonly positionNode?: Node<"vec3">;

  constructor(
    context: VSMContext,
    jobs: VSMJobSource,
    casters: VSMCaster[],
    kind: VSMLayerKind,
  ) {
    const { lightBasis } = context;
    this.positionNode = casters[0].positionNode;
    this.jobs = jobs;
    const content = this.collectContent(casters);
    this.maskSources = content.maskSources;
    this.hasMasks = content.maskSources.length > 0;
    const instanceClusterCapacity = getCapacity(
      content.instanceClusters.length / 4,
    );
    this.positionValues = new Float32Array(
      getCapacity(content.positions.length),
    );
    this.matrixValues = new Float32Array(
      getCapacity(content.instances.length) * 16,
    );
    this.instanceClusterValues = new Uint32Array(instanceClusterCapacity * 4);
    this.clusterBoundValues = new Float32Array(
      getCapacity(content.clusterBounds.length),
    );
    this.positionsAttribute = new StorageBufferAttribute(
      this.positionValues,
      4,
    );
    this.instanceClustersAttribute = new StorageBufferAttribute(
      this.instanceClusterValues,
      4,
    );
    this.matricesAttribute = new StorageBufferAttribute(this.matrixValues, 4);
    this.clusterBoundsAttribute = new StorageBufferAttribute(
      this.clusterBoundValues,
      4,
    );
    this.rasterJobs = storage(
      context.pageJobs,
      "uvec4",
      VSM_JOB_COUNT,
    ).toReadOnly();
    this.rasterWorkCount = storage(
      this.workCountAttribute,
      "uint",
      1,
    ).toReadOnly();
    this.rasterWorkItems = storage(
      this.workItemsAttribute,
      "uvec2",
      VSM_CLUSTER_MAX_WORK_ITEMS,
    ).toReadOnly();
    this.rasterInstanceClusters = storage(
      this.instanceClustersAttribute,
      "uvec4",
      this.instanceClustersAttribute.count,
    ).toReadOnly();
    this.rasterPositions = storage(
      this.positionsAttribute,
      "vec4",
      this.positionsAttribute.count,
    ).toReadOnly();
    this.rasterMatrices = storage(
      this.matricesAttribute,
      "vec4",
      this.matricesAttribute.count,
    ).toReadOnly();
    if (this.hasMasks) {
      const masksAttribute = new StorageBufferAttribute(
        new Uint32Array(content.maskSources.length * VSM_MASK_WORDS),
        1,
      );
      this.rasterMasks = storage(
        masksAttribute,
        "uint",
        masksAttribute.count,
      ).toReadOnly();
      const masks = createMasksNode(masksAttribute);
      for (let index = 0; index < content.maskSources.length; index++) {
        const { opacityNode, alphaTest } = content.maskSources[index];
        const bakeNode = bakeOpacityMask(
          masks,
          uint(index * VSM_MASK_WORDS),
          opacityNode,
          float(alphaTest),
        ).compute(VSM_MASK_WORDS, [64]);
        bakeNode.name = "VSM opacity mask";
        this.bakeNodes.push(bakeNode);
      }
    }
    const lightBoundsAttribute = new StorageBufferAttribute(
      new Float32Array(instanceClusterCapacity * 4),
      4,
    );
    const lightBounds = createVec4Node(
      lightBoundsAttribute,
      instanceClusterCapacity,
    );
    const workCounter = createWorkCounterNode(this.workCountAttribute);
    const jobCounts = storage(
      jobs.countAttribute,
      "uint",
      jobs.countLength,
    ).toReadOnly();

    this.boundsNode = computeClusterLightBounds(
      createUvec4Node(this.instanceClustersAttribute, instanceClusterCapacity),
      createVec4Node(
        this.clusterBoundsAttribute,
        this.clusterBoundsAttribute.count,
      ),
      createVec4Node(this.positionsAttribute, this.positionsAttribute.count),
      createVec4Node(this.matricesAttribute, this.matricesAttribute.count),
      lightBounds,
      lightBasis,
      this.positionNode,
    ).compute(1, [64]);
    this.resetNode = resetWorkCount(workCounter).compute(1, [1]);
    this.buildNode = collectClusterWork(
      lightBounds,
      createUvec4Node(context.pageJobs, VSM_JOB_COUNT),
      jobCounts.element(jobs.countIndex),
      uint(jobs.offset),
      workCounter,
      createWorkItemsNode(this.workItemsAttribute),
    ).compute(1, [64]);

    this.boundsNode.name = "VSM cluster bounds";
    this.resetNode.name = "VSM cluster work reset";
    this.buildNode.name = "VSM cluster work";
    if (kind === "dynamic") {
      this.markNode = markClusterPages(
        lightBounds,
        context.pageTableNode,
        context.frame,
        context.cameraPosition,
        lightBasis,
      ).compute(1, [64]);
      this.markNode.name = "VSM cluster pages";
    }
    this.writeContent(content);
  }

  getWorkCount() {
    const workCount = this.rasterWorkCount.element(0);
    const isWithinCapacity = workCount.lessThan(VSM_CLUSTER_MAX_WORK_ITEMS);
    return isWithinCapacity.select(workCount, uint(VSM_CLUSTER_MAX_WORK_ITEMS));
  }

  getWork(index: Node<"uint">): VSMRasterWork {
    const workItem = this.rasterWorkItems.element(index).toVar();
    const jobIndex = workItem.x.add(this.jobs.offset);
    const job = this.rasterJobs.element(jobIndex).toVar();
    const instanceCluster = this.rasterInstanceClusters
      .element(workItem.y)
      .toVar();
    let maskId: Node<"uint"> = uint(0);
    if (this.hasMasks) {
      const columnX = this.rasterMatrices.element(instanceCluster.x.mul(4));
      maskId = uint(columnX.w);
    }
    return {
      slot: job.y,
      level: job.x.div(VSM_PAGES_PER_LEVEL),
      pageCoordinate: job.zw,
      firstVertex: instanceCluster.y,
      triangleCount: instanceCluster.w,
      instance: instanceCluster.x,
      maskId,
    };
  }

  getCorner(work: VSMRasterWork, vertex: Node<"uint">) {
    const local = this.rasterPositions.element(vertex).xyz.toVar();
    const translationIndex = work.instance.mul(4).add(3);
    const depthBias = this.rasterMatrices.element(translationIndex).w;
    const world = getWorldPosition(
      this.rasterMatrices,
      work.instance,
      local,
      this.positionNode,
    );
    return vec4(world, depthBias);
  }

  getUv(vertex: Node<"uint">) {
    const packedUv = this.rasterPositions.element(vertex).w;
    const v = packedUv.div(UV_STEPS).floor();
    const u = packedUv.sub(v.mul(UV_STEPS));
    return vec2(u, v).div(UV_LAST_STEP);
  }

  isMaskSolid(work: VSMRasterWork, uv: Node<"vec2">) {
    if (!this.rasterMasks) return bool(true);
    const maskTexel = uv
      .clamp(0, 1)
      .mul(VSM_MASK_SIZE)
      .min(VSM_MASK_SIZE - 1);
    const texel = uvec2(maskTexel);
    const texelIndex = texel.y.mul(VSM_MASK_SIZE).add(texel.x).toVar();
    const maskBase = work.maskId.sub(1).mul(VSM_MASK_WORDS);
    const wordIndex = maskBase.add(texelIndex.shiftRight(5));
    const word = this.rasterMasks.element(wordIndex);
    return word.shiftRight(texelIndex.bitAnd(31)).bitAnd(1).notEqual(0);
  }

  setCasters(casters: VSMCaster[]) {
    const content = this.collectContent(casters);
    const { maskSources } = this;
    // the bake kernels are built per mask, so a different set needs a new bucket
    let hasSameMasks = content.maskSources.length === maskSources.length;
    for (let index = 0; hasSameMasks && index < maskSources.length; index++) {
      const current = maskSources[index];
      const next = content.maskSources[index];
      hasSameMasks =
        current.opacityNode === next.opacityNode &&
        current.alphaTest === next.alphaTest;
    }
    const hasRoom =
      content.positions.length <= this.positionValues.length &&
      content.instances.length * 16 <= this.matrixValues.length &&
      content.instanceClusters.length <= this.instanceClusterValues.length &&
      content.clusterBounds.length <= this.clusterBoundValues.length;
    if (!hasSameMasks || !hasRoom) return false;
    this.writeContent(content);
    return true;
  }

  invalidateBounds() {
    this.hasDirtyBounds = true;
  }

  updateMatrices() {
    this.bounds.makeEmpty();
    if (this.positionNode) this.bounds.setFromObject(this.instances[0].mesh);
    for (let index = 0; index < this.instances.length; index++) {
      const { mesh, caster, batchInstanceId, maskId } = this.instances[index];
      mesh.updateWorldMatrix(true, false);
      this.worldMatrix.copy(mesh.matrixWorld);
      if (mesh instanceof BatchedMesh && batchInstanceId !== undefined) {
        mesh.getMatrixAt(batchInstanceId, this.batchMatrix);
        this.worldMatrix.multiply(this.batchMatrix);
      }
      this.matrixValues.set(this.worldMatrix.elements, index * 16);
      this.matrixValues[index * 16 + 3] = maskId;
      this.matrixValues[index * 16 + 15] = caster.depthBias;
      if (this.positionNode) continue;
      const geometry = mesh.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      if (!geometry.boundingBox) continue;
      this.instanceBounds.copy(geometry.boundingBox);
      this.instanceBounds.applyMatrix4(this.worldMatrix);
      this.bounds.union(this.instanceBounds);
    }
    this.matricesAttribute.needsUpdate = true;
    this.hasDirtyBounds = true;
  }

  collectBoundsNodes(nodes: ComputeNode[]) {
    if (this.hasDirtyBounds || this.positionNode) nodes.push(this.boundsNode);
    this.hasDirtyBounds = false;
    if (this.markNode) nodes.push(this.markNode);
  }

  collectWorkNodes(nodes: ComputeNode[]) {
    if (this.hasPendingBake) nodes.push(...this.bakeNodes);
    this.hasPendingBake = false;
    nodes.push(this.resetNode, this.buildNode);
  }

  dispose() {
    this.boundsNode.dispose();
    this.resetNode.dispose();
    this.buildNode.dispose();
    if (this.markNode) this.markNode.dispose();
    for (const bakeNode of this.bakeNodes) bakeNode.dispose();
  }

  private writeContent(content: ClusterContent) {
    this.instances = content.instances;
    this.positionValues.set(content.positions);
    this.instanceClusterValues.set(content.instanceClusters);
    this.clusterBoundValues.set(content.clusterBounds);
    this.positionsAttribute.needsUpdate = true;
    this.instanceClustersAttribute.needsUpdate = true;
    this.clusterBoundsAttribute.needsUpdate = true;
    const instanceClusterCount = content.instanceClusters.length / 4;
    this.boundsNode.count = instanceClusterCount;
    this.buildNode.count = instanceClusterCount;
    if (this.markNode) this.markNode.count = instanceClusterCount;
    this.updateMatrices();
  }

  private collectContent(casters: VSMCaster[]): ClusterContent {
    const geometries = new Map<string, ClusterGeometry>();
    const content: ClusterContent = {
      instances: [],
      positions: [],
      clusterBounds: [],
      instanceClusters: [],
      maskSources: [],
    };
    const clusterTriangles: number[] = [];
    const range = { start: 0, count: 0 };
    for (const caster of casters) {
      const { mesh, opacityNode, alphaTest } = caster;
      let maskId = 0;
      if (opacityNode) {
        content.maskSources.push({ opacityNode, alphaTest });
        maskId = content.maskSources.length;
      }
      for (const batchInstanceId of getInstanceBatchIds(caster)) {
        const isBatchInstance =
          mesh instanceof BatchedMesh && batchInstanceId !== undefined;
        let geometryId = -1;
        if (isBatchInstance) geometryId = mesh.getGeometryIdAt(batchInstanceId);
        const key = `${mesh.geometry.uuid}:${geometryId}`;
        let clusters = geometries.get(key);
        if (!clusters) {
          if (mesh instanceof BatchedMesh) {
            const batchRange = mesh.getGeometryRangeAt(geometryId);
            if (!batchRange)
              throw new Error(`Missing batched geometry range: ${mesh.name}`);
            range.start = batchRange.start;
            range.count = batchRange.count;
          } else {
            const { index } = mesh.geometry;
            range.start = 0;
            range.count = mesh.geometry.getAttribute("position").count;
            if (index) range.count = index.count;
          }
          clusters = appendGeometryClusters(
            mesh.geometry,
            range,
            content.positions,
            content.clusterBounds,
            clusterTriangles,
          );
          geometries.set(key, clusters);
        }
        content.instances.push({
          mesh,
          caster,
          batchInstanceId,
          firstCluster: clusters.firstCluster,
          clusterCount: clusters.clusterCount,
          maskId,
        });
      }
    }
    for (let index = 0; index < content.instances.length; index++) {
      const { firstCluster, clusterCount } = content.instances[index];
      for (let cluster = 0; cluster < clusterCount; cluster++)
        content.instanceClusters.push(
          index,
          (firstCluster + cluster) * VSM_CLUSTER_VERTICES,
          firstCluster + cluster,
          clusterTriangles[firstCluster + cluster],
        );
    }
    return content;
  }
}
