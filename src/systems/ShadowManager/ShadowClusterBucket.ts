import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Vector3,
  type Mesh,
} from "three";
import {
  BatchedMesh,
  IndirectStorageBufferAttribute,
  StorageBufferAttribute,
  type Node,
  type WebGPURenderer,
} from "three/webgpu";
import {
  atomicAdd,
  atomicStore,
  Fn,
  If,
  instanceIndex,
  Loop,
  storage,
  uvec2,
  vec4,
} from "three/tsl";
import type { ShadowCasterEntry } from "./ShadowCasterRegistry";
import {
  SHADOW_PAGES_PER_LEVEL,
  getShadowLightPosition,
  getShadowPageCoordinate,
  getShadowPageSize,
} from "./ShadowPageCoordinates";
import type { ShadowResidency } from "./ShadowResidency";

export const SHADOW_CLUSTER_TRIANGLES = 64;
export const SHADOW_CLUSTER_VERTICES = SHADOW_CLUSTER_TRIANGLES * 3;
const MAX_WORK_ITEMS = 262144;

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

export class ShadowClusterBucket {
  readonly geometry = new BufferGeometry();
  readonly positionsAttribute: StorageBufferAttribute;
  readonly uvsAttribute?: StorageBufferAttribute;
  readonly matricesAttribute: StorageBufferAttribute;
  readonly instanceClustersAttribute: StorageBufferAttribute;
  readonly workItemsAttribute = new StorageBufferAttribute(
    new Uint32Array(MAX_WORK_ITEMS * 2),
    2,
  );
  readonly bounds = new Box3();
  private renderer: WebGPURenderer;
  private instances: ClusterInstance[] = [];
  private matrixValues: Float32Array;
  private hasDirtyBounds = true;
  private boundsNode;
  private resetNode;
  private buildNode;
  private batchMatrix = new Matrix4();
  private worldMatrix = new Matrix4();
  private instanceBounds = new Box3();

  constructor(
    renderer: WebGPURenderer,
    residency: ShadowResidency,
    entries: ShadowCasterEntry[],
    sunDirection: Node<"vec3">,
    hasUvs: boolean,
  ) {
    this.renderer = renderer;
    const geometries = new Map<string, ClusterGeometry>();
    const positions: number[] = [];
    const uvs: number[] = [];
    const clusterBounds: number[] = [];
    const range = { start: 0, count: 0 };
    for (const entry of entries) {
      const { mesh } = entry;
      const batchIds: (number | undefined)[] = [];
      if (mesh instanceof BatchedMesh) {
        for (let id = 0; id < mesh.instanceCount; id++)
          if (mesh.getVisibleAt(id)) batchIds.push(id);
      } else batchIds.push(undefined);
      for (const batchInstanceId of batchIds) {
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
          clusters = this.appendClusters(
            mesh.geometry,
            range,
            positions,
            hasUvs ? uvs : undefined,
            clusterBounds,
          );
          geometries.set(key, clusters);
        }
        this.instances.push({
          mesh,
          batchInstanceId,
          firstCluster: clusters.firstCluster,
          clusterCount: clusters.clusterCount,
          depthBias: entry.depthBias,
        });
      }
    }

    const instanceClusters: number[] = [];
    for (let index = 0; index < this.instances.length; index++) {
      const { firstCluster, clusterCount } = this.instances[index];
      for (let cluster = 0; cluster < clusterCount; cluster++)
        instanceClusters.push(
          index,
          (firstCluster + cluster) * SHADOW_CLUSTER_VERTICES,
          firstCluster + cluster,
          0,
        );
    }
    const instanceClusterCount = instanceClusters.length / 4;
    this.positionsAttribute = new StorageBufferAttribute(
      new Float32Array(positions),
      4,
    );
    if (hasUvs)
      this.uvsAttribute = new StorageBufferAttribute(new Float32Array(uvs), 2);
    this.instanceClustersAttribute = new StorageBufferAttribute(
      new Uint32Array(instanceClusters),
      4,
    );
    this.matrixValues = new Float32Array(this.instances.length * 16);
    this.matricesAttribute = new StorageBufferAttribute(this.matrixValues, 4);
    const clusterBoundsNode = storage(
      new StorageBufferAttribute(new Float32Array(clusterBounds), 4),
      "vec4",
      clusterBounds.length / 4,
    );
    const lightBoundsNode = storage(
      new StorageBufferAttribute(new Float32Array(instanceClusterCount * 4), 4),
      "vec4",
      instanceClusterCount,
    );
    const instanceClustersNode = storage(
      this.instanceClustersAttribute,
      "uvec4",
      instanceClusterCount,
    );
    const matricesNode = storage(
      this.matricesAttribute,
      "vec4",
      this.instances.length * 4,
    );
    const workItems = storage(this.workItemsAttribute, "uvec2", MAX_WORK_ITEMS);
    const pageJobs = storage(
      residency.pageJobsAttribute,
      "uvec4",
      residency.capacity * 3,
    );
    const atlasIndirect = storage(residency.atlasIndirectAttribute, "uint", 8);
    const indirect = new IndirectStorageBufferAttribute(
      new Uint32Array([SHADOW_CLUSTER_VERTICES, 0, 0, 0]),
      1,
    );
    const indirectNode = storage(indirect, "uint", 4).toAtomic();
    this.geometry.setAttribute(
      "position",
      new Float32BufferAttribute(
        new Float32Array(SHADOW_CLUSTER_VERTICES * 3),
        3,
      ),
    );
    this.geometry.setIndirect(indirect);

    this.boundsNode = Fn(() => {
      const instanceCluster = instanceClustersNode.element(instanceIndex);
      const matrixOffset = instanceCluster.x.mul(4);
      const minimum = clusterBoundsNode.element(instanceCluster.z.mul(2)).xyz;
      const maximum = clusterBoundsNode.element(
        instanceCluster.z.mul(2).add(1),
      ).xyz;
      const lightBounds = vec4(1e8, 1e8, -1e8, -1e8).toVar();
      for (let corner = 0; corner < 8; corner++) {
        const local = vec4(
          corner & 1 ? maximum.x : minimum.x,
          corner & 2 ? maximum.y : minimum.y,
          corner & 4 ? maximum.z : minimum.z,
          1,
        );
        const world = matricesNode
          .element(matrixOffset)
          .mul(local.x)
          .add(matricesNode.element(matrixOffset.add(1)).mul(local.y))
          .add(matricesNode.element(matrixOffset.add(2)).mul(local.z))
          .add(matricesNode.element(matrixOffset.add(3))).xyz;
        const light = getShadowLightPosition(world, sunDirection);
        lightBounds.assign(
          vec4(lightBounds.xy.min(light), lightBounds.zw.max(light)),
        );
      }
      lightBoundsNode.element(instanceIndex).assign(lightBounds);
    })().compute(instanceClusterCount, [64]);

    this.resetNode = Fn(() => {
      atomicStore(indirectNode.element(1), 0);
    })().compute(1, [1]);

    this.buildNode = Fn(() => {
      const lightBounds = lightBoundsNode.element(instanceIndex).toVar();
      const jobCount = atlasIndirect.element(1).toVar();
      Loop({ start: 0, end: jobCount, type: "uint" }, ({ i: jobLoopIndex }) => {
        const jobIndex = jobLoopIndex.toVar();
        const job = pageJobs.element(jobIndex);
        const pageSize = getShadowPageSize(job.x.div(SHADOW_PAGES_PER_LEVEL));
        const firstPage = getShadowPageCoordinate(lightBounds.xy.div(pageSize));
        const lastPage = getShadowPageCoordinate(lightBounds.zw.div(pageSize));
        const overlaps = job.z
          .greaterThanEqual(firstPage.x)
          .and(job.w.greaterThanEqual(firstPage.y))
          .and(job.z.lessThanEqual(lastPage.x))
          .and(job.w.lessThanEqual(lastPage.y));
        If(overlaps, () => {
          const itemIndex = atomicAdd(indirectNode.element(1), 1);
          If(itemIndex.lessThan(MAX_WORK_ITEMS), () => {
            workItems.element(itemIndex).assign(uvec2(jobIndex, instanceIndex));
          });
        });
      });
    })().compute(instanceClusterCount, [64]);

    this.boundsNode.name = "V2 shadow cluster bounds";
    this.resetNode.name = "V2 shadow cluster work reset";
    this.buildNode.name = "V2 shadow cluster work";
    this.updateMatrices();
  }

  invalidateBounds() {
    this.hasDirtyBounds = true;
  }

  updateMatrices() {
    this.bounds.makeEmpty();
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

  run() {
    if (this.hasDirtyBounds) {
      this.renderer.compute(this.boundsNode);
      this.hasDirtyBounds = false;
    }
    this.renderer.compute(this.resetNode);
    this.renderer.compute(this.buildNode);
  }

  dispose() {
    this.geometry.dispose();
  }

  private appendClusters(
    geometry: BufferGeometry,
    range: { start: number; count: number },
    positions: number[],
    uvs: number[] | undefined,
    clusterBounds: number[],
  ): ClusterGeometry {
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    const index = geometry.index;
    const firstCluster = clusterBounds.length / 8;
    const triangleCount = Math.floor(range.count / 3);
    const clusterCount = Math.ceil(triangleCount / SHADOW_CLUSTER_TRIANGLES);
    const minimum = new Vector3();
    const maximum = new Vector3();
    const vertex = new Vector3();
    for (let cluster = 0; cluster < clusterCount; cluster++) {
      minimum.setScalar(Infinity);
      maximum.setScalar(-Infinity);
      for (let corner = 0; corner < SHADOW_CLUSTER_VERTICES; corner++) {
        const triangle = Math.min(
          cluster * SHADOW_CLUSTER_TRIANGLES + Math.floor(corner / 3),
          triangleCount - 1,
        );
        const isPadding =
          cluster * SHADOW_CLUSTER_TRIANGLES + Math.floor(corner / 3) >=
          triangleCount;
        const element =
          range.start +
          (isPadding ? triangle * 3 : triangle * 3 + (corner % 3));
        const vertexIndex = index ? index.getX(element) : element;
        vertex.fromBufferAttribute(position, vertexIndex);
        positions.push(vertex.x, vertex.y, vertex.z, 0);
        if (uvs)
          uvs.push(
            uv ? uv.getX(vertexIndex) : 0,
            uv ? uv.getY(vertexIndex) : 0,
          );
        minimum.min(vertex);
        maximum.max(vertex);
      }
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
  }
}
