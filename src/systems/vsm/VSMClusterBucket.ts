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
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { VSMRasterWork } from "./VSMDepthPool";
import {
  VSM_PAGES_PER_LEVEL,
  getLightPosition,
  getPageCoordinate,
  getPageSize,
} from "./VSMMath";
import {
  VSM_JOB_COUNT,
  type VSMCaster,
  type VSMContext,
  type VSMJobSource,
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
      const triangle = Math.min(
        cluster * VSM_CLUSTER_TRIANGLES + Math.floor(corner / 3),
        triangleCount - 1,
      );
      const isPadding =
        cluster * VSM_CLUSTER_TRIANGLES + Math.floor(corner / 3) >=
        triangleCount;
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
    clusterTriangles.push(
      Math.min(
        VSM_CLUSTER_TRIANGLES,
        triangleCount - cluster * VSM_CLUSTER_TRIANGLES,
      ),
    );
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
  return matrices
    .element(matrixOffset)
    .mul(local.x)
    .add(matrices.element(matrixOffset.add(1)).mul(local.y))
    .add(matrices.element(matrixOffset.add(2)).mul(local.z))
    .add(matrices.element(matrixOffset.add(3))).xyz;
};

const computeClusterLightBounds = Fn<
  [
    instanceClusters: Uvec4Node,
    clusterBounds: Vec4Node,
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
    matrices,
    lightBounds,
    lightBasis,
    positionNode,
  ]) => {
    const instanceCluster = instanceClusters.element(instanceIndex).toVar();
    const minimum = clusterBounds.element(instanceCluster.z.mul(2)).xyz.toVar();
    const maximum = clusterBounds
      .element(instanceCluster.z.mul(2).add(1))
      .xyz.toVar();
    const bounds = vec4(1e8, 1e8, -1e8, -1e8).toVar();
    Loop({ start: 0, end: 8, type: "uint" }, ({ i: corner }) => {
      const cornerSide = vec3(
        corner.bitAnd(1),
        corner.shiftRight(1).bitAnd(1),
        corner.shiftRight(2).bitAnd(1),
      );
      const local = maximum.sub(minimum).mul(cornerSide).add(minimum).toVar();
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
    const overlaps = job.z
      .greaterThanEqual(firstPage.x)
      .and(job.w.greaterThanEqual(firstPage.y))
      .and(job.z.lessThanEqual(lastPage.x))
      .and(job.w.lessThanEqual(lastPage.y));
    If(overlaps, () => {
      const itemIndex = atomicAdd(workCounter.element(WORK_COUNT_INDEX), 1);
      If(itemIndex.lessThan(VSM_CLUSTER_MAX_WORK_ITEMS), () => {
        workItems.element(itemIndex).assign(uvec2(jobIndex, instanceIndex));
      });
    });
  });
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
    this.writeContent(content);
  }

  getWorkCount() {
    const workCount = this.rasterWorkCount.element(WORK_COUNT_INDEX);
    return workCount
      .lessThan(VSM_CLUSTER_MAX_WORK_ITEMS)
      .select(workCount, uint(VSM_CLUSTER_MAX_WORK_ITEMS));
  }

  getWork(index: Node<"uint">): VSMRasterWork {
    const workItem = this.rasterWorkItems.element(index).toVar();
    const job = this.rasterJobs
      .element(workItem.x.add(this.jobs.offset))
      .toVar();
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
    const depthBias = this.rasterMatrices.element(
      work.instance.mul(4).add(3),
    ).w;
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
      if (geometry.boundingBox)
        this.bounds.union(
          this.instanceBounds
            .copy(geometry.boundingBox)
            .applyMatrix4(this.worldMatrix),
        );
    }
    this.matricesAttribute.needsUpdate = true;
    this.hasDirtyBounds = true;
  }

  collectComputeNodes(nodes: ComputeNode[]) {
    if (this.hasDirtyBounds || this.positionNode) nodes.push(this.boundsNode);
    nodes.push(this.resetNode, this.buildNode);
    this.hasDirtyBounds = false;
  }

  dispose() {
    this.boundsNode.dispose();
    this.resetNode.dispose();
    this.buildNode.dispose();
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
