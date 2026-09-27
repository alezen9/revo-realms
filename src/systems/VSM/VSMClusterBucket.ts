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
export const VSM_CLUSTER_VERTICES = VSM_CLUSTER_TRIANGLES * 3;
export const VSM_CLUSTER_MAX_WORK_ITEMS = 262144;

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

export const appendGeometryClusters = (
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
      const element =
        range.start + (isPadding ? triangle * 3 : triangle * 3 + (corner % 3));
      const vertexIndex = index ? index.getX(element) : element;
      vertex.fromBufferAttribute(position, vertexIndex);
      positions.push(vertex.x, vertex.y, vertex.z, 0);
      if (uvs)
        uvs.push(uv ? uv.getX(vertexIndex) : 0, uv ? uv.getY(vertexIndex) : 0);
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
  private rasterUvs;
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
    this.uvValues = new Float32Array(
      hasUvs ? getCapacity(content.uvs.length) : 2,
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
    this.rasterUvs = this.uvsAttribute
      ? storage(this.uvsAttribute, "vec2", this.uvsAttribute.count).toReadOnly()
      : undefined;
    const lightBoundsAttribute = new StorageBufferAttribute(
      new Float32Array(instanceClusterCapacity * 4),
      4,
    );
    const clusterBoundsNode = storage(
      this.clusterBoundsAttribute,
      "vec4",
      this.clusterBoundsAttribute.count,
    );
    const lightBoundsNode = storage(
      lightBoundsAttribute,
      "vec4",
      instanceClusterCapacity,
    );
    const instanceClustersNode = storage(
      this.instanceClustersAttribute,
      "uvec4",
      instanceClusterCapacity,
    );
    const matricesNode = storage(
      this.matricesAttribute,
      "vec4",
      this.matricesAttribute.count,
    );
    const workItems = storage(
      this.workItemsAttribute,
      "uvec2",
      VSM_CLUSTER_MAX_WORK_ITEMS,
    );
    const pageJobs = storage(context.pageJobs, "uvec4", VSM_JOB_COUNT);
    const jobCounts = storage(
      jobs.countAttribute,
      "uint",
      jobs.countLength,
    ).toReadOnly();
    const indirectNode = storage(
      this.workIndirectAttribute,
      "uint",
      4,
    ).toAtomic();

    this.boundsNode = Fn(() => {
      const instanceCluster = instanceClustersNode
        .element(instanceIndex)
        .toVar();
      const minimum = clusterBoundsNode
        .element(instanceCluster.z.mul(2))
        .xyz.toVar();
      const maximum = clusterBoundsNode
        .element(instanceCluster.z.mul(2).add(1))
        .xyz.toVar();
      const lightBounds = vec4(1e8, 1e8, -1e8, -1e8).toVar();
      Loop({ start: 0, end: 8, type: "uint" }, ({ i: corner }) => {
        const cornerSide = vec3(
          corner.bitAnd(1),
          corner.shiftRight(1).bitAnd(1),
          corner.shiftRight(2).bitAnd(1),
        );
        const local = maximum.sub(minimum).mul(cornerSide).add(minimum).toVar();
        const light = getLightPosition(
          this.getWorldPosition(matricesNode, instanceCluster.x, local),
          lightBasis,
        );
        lightBounds.assign(
          vec4(lightBounds.xy.min(light), lightBounds.zw.max(light)),
        );
      });
      lightBoundsNode.element(instanceIndex).assign(lightBounds);
    })().compute(1, [64]);

    this.resetNode = Fn(() => {
      atomicStore(indirectNode.element(1), 0);
    })().compute(1, [1]);

    this.buildNode = Fn(() => {
      const lightBounds = lightBoundsNode.element(instanceIndex).toVar();
      const jobCount = jobCounts.element(jobs.countIndex).toVar();
      Loop({ start: 0, end: jobCount, type: "uint" }, ({ i: jobLoopIndex }) => {
        const jobIndex = jobLoopIndex.toVar();
        const job = pageJobs.element(jobIndex.add(jobs.offset));
        const pageSize = getPageSize(job.x.div(VSM_PAGES_PER_LEVEL));
        const firstPage = getPageCoordinate(lightBounds.xy.div(pageSize));
        const lastPage = getPageCoordinate(lightBounds.zw.div(pageSize));
        const overlaps = job.z
          .greaterThanEqual(firstPage.x)
          .and(job.w.greaterThanEqual(firstPage.y))
          .and(job.z.lessThanEqual(lastPage.x))
          .and(job.w.lessThanEqual(lastPage.y));
        If(overlaps, () => {
          const itemIndex = atomicAdd(indirectNode.element(1), 1);
          If(itemIndex.lessThan(VSM_CLUSTER_MAX_WORK_ITEMS), () => {
            workItems.element(itemIndex).assign(uvec2(jobIndex, instanceIndex));
          });
        });
      });
    })().compute(1, [64]);

    this.boundsNode.name = "V2 shadow cluster bounds";
    this.resetNode.name = "V2 shadow cluster work reset";
    this.buildNode.name = "V2 shadow cluster work";
    this.writeContent(content);
  }

  getWorkCount() {
    const count = this.rasterWorkCount.element(1);
    return count
      .lessThan(VSM_CLUSTER_MAX_WORK_ITEMS)
      .select(count, uint(VSM_CLUSTER_MAX_WORK_ITEMS));
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
    const world = this.getWorldPosition(
      this.rasterMatrices,
      work.instance,
      local,
    );
    return vec4(world, depthBias);
  }

  private getWorldPosition(
    matrices: StorageBufferNode<"vec4">,
    instance: Node<"uint">,
    local: Node<"vec3">,
  ) {
    if (this.positionNode)
      return this.positionNode.context({
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
  }

  getUv(vertex: Node<"uint">) {
    return this.rasterUvs ? this.rasterUvs.element(vertex) : vec2(0);
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
        const geometryId =
          mesh instanceof BatchedMesh && batchInstanceId !== undefined
            ? mesh.getGeometryIdAt(batchInstanceId)
            : -1;
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
            range.start = 0;
            range.count = mesh.geometry.index
              ? mesh.geometry.index.count
              : mesh.geometry.getAttribute("position").count;
          }
          clusters = appendGeometryClusters(
            mesh.geometry,
            range,
            content.positions,
            this.hasUvs ? content.uvs : undefined,
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
