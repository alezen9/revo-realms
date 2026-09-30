import { Box3, Matrix4, Vector3, type BufferGeometry, type Mesh } from "three";
import {
  BatchedMesh,
  IndirectStorageBufferAttribute,
  StorageBufferAttribute,
} from "three/webgpu";
import type { ComputeNode, Node, StorageBufferNode } from "three/webgpu";
import {
  atomicAdd,
  atomicStore,
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
// indirect args: x -> vertices per cluster, y -> work item count
const WORK_COUNT_INDEX = 1;

type ClusterInstance = {
  mesh: Mesh;
  batchInstanceId?: number;
  firstCluster: number;
  clusterCount: number;
  depthBias: number;
};

type ClusterGeometry = {
  firstCluster: number;
  clusterCount: number;
};

type ClusterContent = {
  instances: ClusterInstance[];
  positions: number[];
  uvs: number[];
  clusterBounds: number[];
  instanceClusters: number[];
};

const appendGeometryClusters = (
  geometry: BufferGeometry,
  range: { start: number; count: number },
  positions: number[],
  uvs: number[] | undefined,
  clusterBounds: number[],
  clusterTriangles: number[],
): ClusterGeometry => {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const index = geometry.index;
  const firstCluster = clusterBounds.length / 8;
  const triangleCount = Math.floor(range.count / 3);
  const clusterCount = Math.ceil(triangleCount / VSM_CLUSTER_TRIANGLES);
  const minimum = new Vector3();
  const maximum = new Vector3();
  const vertex = new Vector3();
  for (let cluster = 0; cluster < clusterCount; cluster++) {
    minimum.setScalar(Infinity);
    maximum.setScalar(-Infinity);
    for (let corner = 0; corner < VSM_CLUSTER_VERTICES; corner++) {
      const clusterTriangle =
        cluster * VSM_CLUSTER_TRIANGLES + Math.floor(corner / 3);
      const triangle = Math.min(clusterTriangle, triangleCount - 1);
      const isPadding = clusterTriangle >= triangleCount;
      // padding repeats the last triangle's first corner, a zero area triangle
      let cornerOffset = corner % 3;
      if (isPadding) cornerOffset = 0;
      const element = range.start + triangle * 3 + cornerOffset;
      let vertexIndex = element;
      if (index) vertexIndex = index.getX(element);
      vertex.fromBufferAttribute(position, vertexIndex);
      positions.push(vertex.x, vertex.y, vertex.z, 0);
      if (uvs && uv) uvs.push(uv.getX(vertexIndex), uv.getY(vertexIndex));
      if (uvs && !uv) uvs.push(0, 0);
      minimum.min(vertex);
      maximum.max(vertex);
    }
    const remainingTriangles = triangleCount - cluster * VSM_CLUSTER_TRIANGLES;
    clusterTriangles.push(Math.min(VSM_CLUSTER_TRIANGLES, remainingTriangles));
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
  return { firstCluster, clusterCount };
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
  storage(attribute, "uint", 4).toAtomic();

type Vec4Node = ReturnType<typeof createVec4Node>;
type Uvec4Node = ReturnType<typeof createUvec4Node>;
type WorkItemsNode = ReturnType<typeof createWorkItemsNode>;
type WorkCounterNode = ReturnType<typeof createWorkCounterNode>;

const getWorldPosition = (
  matrices: StorageBufferNode<"vec4">,
  instance: Node<"uint">,
  local: Node<"vec3">,
  positionNode: Node<"vec3"> | undefined,
) => {
  if (positionNode)
    return positionNode.context({
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
    .mul(local.x)
    .add(columnY.mul(local.y))
    .add(columnZ.mul(local.z))
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

const resetWorkCount = Fn<[workCounter: WorkCounterNode], void>(
  ([workCounter]) => {
    atomicStore(workCounter.element(WORK_COUNT_INDEX), 0);
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
    const overlaps = isPastFirstPage.and(isBeforeLastPage);
    If(overlaps, () => {
      const itemIndex = atomicAdd(workCounter.element(WORK_COUNT_INDEX), 1);
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
          const page = pageTable.element(pageKey);
          const isInWindow = isPageInWindow(pageCoordinate, windowCenter);
          const isActivePage = page.w.equal(frame);
          If(isInWindow.and(isActivePage), () => {
            page.assign(uvec4(page.x, frame, page.z, page.w));
          });
        },
      );
    },
  );
});

export class VSMClusterBucket {
  readonly positionsAttribute: StorageBufferAttribute;
  readonly uvsAttribute?: StorageBufferAttribute;
  readonly matricesAttribute: StorageBufferAttribute;
  readonly instanceClustersAttribute: StorageBufferAttribute;
  readonly workIndirectAttribute = new IndirectStorageBufferAttribute(
    new Uint32Array([VSM_CLUSTER_VERTICES, 0, 0, 0]),
    1,
  );
  readonly workItemsAttribute = new StorageBufferAttribute(
    new Uint32Array(VSM_CLUSTER_MAX_WORK_ITEMS * 2),
    2,
  );
  readonly bounds = new Box3();
  readonly hasUvs: boolean;
  private jobs: VSMJobSource;
  private instances: ClusterInstance[] = [];
  private positionValues: Float32Array;
  private uvValues: Float32Array;
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
  private rasterUvs?: StorageBufferNode<"vec2">;
  private batchMatrix = new Matrix4();
  private worldMatrix = new Matrix4();
  private instanceBounds = new Box3();
  private readonly positionNode?: Node<"vec3">;

  constructor(
    context: VSMContext,
    jobs: VSMJobSource,
    casters: VSMCaster[],
    hasUvs: boolean,
    kind: VSMLayerKind,
  ) {
    const { lightBasis } = context;
    this.positionNode = casters[0].positionNode;
    this.hasUvs = hasUvs;
    this.jobs = jobs;
    const content = this.collectContent(casters);
    const instanceClusterCapacity = getCapacity(
      content.instanceClusters.length / 4,
    );
    this.positionValues = new Float32Array(
      getCapacity(content.positions.length),
    );
    let uvCapacity = 2;
    if (hasUvs) uvCapacity = getCapacity(content.uvs.length);
    this.uvValues = new Float32Array(uvCapacity);
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
    if (hasUvs)
      this.uvsAttribute = new StorageBufferAttribute(this.uvValues, 2);
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
      this.workIndirectAttribute,
      "uint",
      4,
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
    if (this.uvsAttribute)
      this.rasterUvs = storage(
        this.uvsAttribute,
        "vec2",
        this.uvsAttribute.count,
      ).toReadOnly();
    const lightBoundsAttribute = new StorageBufferAttribute(
      new Float32Array(instanceClusterCapacity * 4),
      4,
    );
    const lightBounds = createVec4Node(
      lightBoundsAttribute,
      instanceClusterCapacity,
    );
    const workCounter = createWorkCounterNode(this.workIndirectAttribute);
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
    const workCount = this.rasterWorkCount.element(WORK_COUNT_INDEX);
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
    return {
      slot: job.y,
      level: job.x.div(VSM_PAGES_PER_LEVEL),
      pageCoordinate: job.zw,
      firstVertex: instanceCluster.y,
      triangleCount: instanceCluster.w,
      instance: instanceCluster.x,
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
    if (!this.rasterUvs) return vec2(0);
    return this.rasterUvs.element(vertex);
  }

  setCasters(casters: VSMCaster[]) {
    const content = this.collectContent(casters);
    const hasRoom =
      content.positions.length <= this.positionValues.length &&
      content.uvs.length <= this.uvValues.length &&
      content.instances.length * 16 <= this.matrixValues.length &&
      content.instanceClusters.length <= this.instanceClusterValues.length &&
      content.clusterBounds.length <= this.clusterBoundValues.length;
    if (!hasRoom) return false;
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
      const { mesh, batchInstanceId, depthBias } = this.instances[index];
      mesh.updateWorldMatrix(true, false);
      this.worldMatrix.copy(mesh.matrixWorld);
      if (mesh instanceof BatchedMesh && batchInstanceId !== undefined) {
        mesh.getMatrixAt(batchInstanceId, this.batchMatrix);
        this.worldMatrix.multiply(this.batchMatrix);
      }
      this.matrixValues.set(this.worldMatrix.elements, index * 16);
      this.matrixValues[index * 16 + 15] = depthBias;
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
    nodes.push(this.resetNode, this.buildNode);
  }

  dispose() {
    this.boundsNode.dispose();
    this.resetNode.dispose();
    this.buildNode.dispose();
    if (this.markNode) this.markNode.dispose();
  }

  private writeContent(content: ClusterContent) {
    this.instances = content.instances;
    this.positionValues.set(content.positions);
    this.uvValues.set(content.uvs);
    this.instanceClusterValues.set(content.instanceClusters);
    this.clusterBoundValues.set(content.clusterBounds);
    this.positionsAttribute.needsUpdate = true;
    if (this.uvsAttribute) this.uvsAttribute.needsUpdate = true;
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
      uvs: [],
      clusterBounds: [],
      instanceClusters: [],
    };
    const clusterTriangles: number[] = [];
    const range = { start: 0, count: 0 };
    for (const caster of casters) {
      const { mesh } = caster;
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
          let uvs: number[] | undefined;
          if (this.hasUvs) uvs = content.uvs;
          clusters = appendGeometryClusters(
            mesh.geometry,
            range,
            content.positions,
            uvs,
            content.clusterBounds,
            clusterTriangles,
          );
          geometries.set(key, clusters);
        }
        content.instances.push({
          mesh,
          batchInstanceId,
          firstCluster: clusters.firstCluster,
          clusterCount: clusters.clusterCount,
          depthBias: caster.depthBias,
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
