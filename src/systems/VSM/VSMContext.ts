import {
  Box3,
  Matrix4,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Camera,
  type Mesh,
} from "three";
import {
  BatchedMesh,
  NodeMaterial,
  StorageBufferAttribute,
  type Node,
  type WebGPURenderer,
} from "three/webgpu";
import { storage, uint, uniform } from "three/tsl";
import {
  VSM_LEVEL_COUNT,
  VSM_PAGE_COUNT,
  computeLightBasis,
  vsmResolutionBias,
  vsmSoftReceiverLevelBias,
} from "./VSMMath";

export const VSM_POOL_CAPACITY = 1024;
export const VSM_DYNAMIC_CAPACITY = 400;
export const VSM_INVALID_PAGE_KEY = 0xffffffff;
export const VSM_JOBS_ALLOCATED = 0;
export const VSM_JOBS_ACTIVE = VSM_POOL_CAPACITY;
export const VSM_JOBS_DYNAMIC = VSM_POOL_CAPACITY * 2;
export const VSM_JOB_COUNT = VSM_POOL_CAPACITY * 3;
export const VSM_COUNTER_REQUESTED = 0;
export const VSM_COUNTER_ALLOCATED = 1;
export const VSM_COUNTER_EVICTED = 2;
export const VSM_COUNTER_MISSING = 3;
export const VSM_COUNTER_ACTIVE = 4;
export const VSM_COUNTER_EMPTY = 5;
export const VSM_COUNTER_REUSABLE = 6;
export const VSM_COUNTER_LEVEL_MISSES = 7;
export const VSM_COUNTER_COUNT = VSM_COUNTER_LEVEL_MISSES + VSM_LEVEL_COUNT;
export const VSM_DYNAMIC_COUNTER_TOTAL = 0;
export const VSM_DYNAMIC_COUNTER_OVERFLOW = 1;
export const VSM_DYNAMIC_COUNTER_LEVEL_COUNTS = 2;
export const VSM_DYNAMIC_COUNTER_LEVEL_CURSORS =
  VSM_DYNAMIC_COUNTER_LEVEL_COUNTS + VSM_LEVEL_COUNT;
export const VSM_DYNAMIC_COUNTER_COUNT =
  VSM_DYNAMIC_COUNTER_LEVEL_CURSORS + VSM_LEVEL_COUNT;

export type VSMCasterKind = "fixed" | "moving" | "deformed";

export type VSMGpuInstances = {
  count: number;
  radiusMeters: number;
  geometry?: BufferGeometry;
  baseWorldPosition: (index: Node<"uint">) => Node<"vec3">;
  height: (index: Node<"uint">) => Node<"float">;
  worldPosition: (index: Node<"uint">, position: Node<"vec3">) => Node<"vec3">;
  isActive: (index: Node<"uint">) => Node<"bool">;
};

export type VSMCasterOptions = {
  motion?: "fixed" | "moving";
  depthBias?: number;
  opacity?: (uv: Node<"vec2">) => Node<"float">;
  gpuInstances?: VSMGpuInstances;
};

export type VSMCaster = {
  mesh: Mesh;
  kind: VSMCasterKind;
  depthBias: number;
  opacity?: (uv: Node<"vec2">) => Node<"float">;
  alphaTest: number;
  gpuInstances?: VSMGpuInstances;
  worldMatrix: Matrix4;
  worldBounds: Box3;
};

export type VSMChanges = {
  hasViewChanged: boolean;
  hasSunChanged: boolean;
  hasLevelBiasChanged: boolean;
  hasStaticRosterChanged: boolean;
  hasStaticCasterMoved: boolean;
  hasStaticBiasChanged: boolean;
  hasDynamicRosterChanged: boolean;
  hasDynamicCasterMoved: boolean;
  shouldRequestPages: boolean;
};

type PreviousFrame = {
  camera?: Camera;
  cameraMatrix: Matrix4;
  projectionMatrix: Matrix4;
  drawingBufferSize: Vector2;
  sunDirection: Vector3;
  resolutionBias: number;
  softReceiverLevelBias: number;
  staticVersion: number;
  staticRevision: number;
  staticBiasVersion: number;
  dynamicVersion: number;
  dynamicRevision: number;
};

const initialMetadata = new Uint32Array(VSM_POOL_CAPACITY * 4);
for (let slot = 0; slot < VSM_POOL_CAPACITY; slot++)
  initialMetadata[slot * 4] = VSM_INVALID_PAGE_KEY;

export class VSMContext {
  readonly casterCounts = { fixed: 0, moving: 0, deformed: 0 };
  readonly changes: VSMChanges = {
    hasViewChanged: true,
    hasSunChanged: true,
    hasLevelBiasChanged: true,
    hasStaticRosterChanged: true,
    hasStaticCasterMoved: true,
    hasStaticBiasChanged: true,
    hasDynamicRosterChanged: true,
    hasDynamicCasterMoved: true,
    shouldRequestPages: true,
  };
  readonly frame = uniform(0, "uint");
  readonly pageGeneration = uniform(1, "uint");
  readonly cameraWorldPosition = new Vector3();
  readonly cameraPosition = uniform(this.cameraWorldPosition);
  readonly projectionMatrixInverse = uniform(new Matrix4());
  readonly cameraWorldMatrix = uniform(new Matrix4());
  readonly sunDirection: Node<"vec3">;
  readonly lightBasis = {
    x: uniform(new Vector3(1, 0, 0)),
    y: uniform(new Vector3(0, 1, 0)),
  };
  readonly drawingBufferSize = new Vector2();
  readonly pageTable = new StorageBufferAttribute(
    new Uint32Array(VSM_PAGE_COUNT * 4),
    4,
  );
  readonly pageTableNode = storage(this.pageTable, "uvec4", VSM_PAGE_COUNT);
  readonly slotMetadata = new StorageBufferAttribute(initialMetadata, 4);
  readonly slotMetadataNode = storage(
    this.slotMetadata,
    "uvec4",
    VSM_POOL_CAPACITY,
  );
  readonly slotRenderFrames = new StorageBufferAttribute(
    new Uint32Array(VSM_POOL_CAPACITY),
    1,
  );
  readonly slotRenderFramesNode = storage(
    this.slotRenderFrames,
    "uint",
    VSM_POOL_CAPACITY,
  );
  readonly pageJobs = new StorageBufferAttribute(
    new Uint32Array(VSM_JOB_COUNT * 4),
    4,
  );
  readonly counters = new StorageBufferAttribute(
    new Uint32Array(VSM_COUNTER_COUNT),
    1,
  );
  readonly dynamicCounters = new StorageBufferAttribute(
    new Uint32Array(VSM_DYNAMIC_COUNTER_COUNT),
    1,
  );
  private renderer: WebGPURenderer;
  private casterEntries = new Map<Mesh, VSMCaster>();
  private dirtyStaticBounds: Box3[] = [];
  private hasPageInvalidation = true;
  private staticVersion = 0;
  private staticRevision = 0;
  private staticBiasVersion = 0;
  private dynamicVersion = 0;
  private dynamicRevision = 0;
  private previous: PreviousFrame = {
    cameraMatrix: new Matrix4(),
    projectionMatrix: new Matrix4(),
    drawingBufferSize: new Vector2(),
    sunDirection: new Vector3(),
    resolutionBias: -1,
    softReceiverLevelBias: -1,
    staticVersion: -1,
    staticRevision: -1,
    staticBiasVersion: -1,
    dynamicVersion: -1,
    dynamicRevision: -1,
  };

  constructor(renderer: WebGPURenderer, sunDirection: Node<"vec3">) {
    this.renderer = renderer;
    this.sunDirection = sunDirection;
  }

  get casters() {
    return this.casterEntries.values();
  }

  beginFrame(camera: Camera, sunDirection: Vector3) {
    const { previous, changes } = this;
    this.renderer.getDrawingBufferSize(this.drawingBufferSize);
    camera.getWorldPosition(this.cameraWorldPosition);
    changes.hasViewChanged =
      camera !== previous.camera ||
      !previous.cameraMatrix.equals(camera.matrixWorld) ||
      !previous.projectionMatrix.equals(camera.projectionMatrix) ||
      !previous.drawingBufferSize.equals(this.drawingBufferSize);
    changes.hasSunChanged = !previous.sunDirection.equals(sunDirection);
    changes.hasLevelBiasChanged =
      previous.resolutionBias !== vsmResolutionBias.value ||
      previous.softReceiverLevelBias !== vsmSoftReceiverLevelBias.value;
    changes.hasStaticRosterChanged =
      previous.staticVersion !== this.staticVersion;
    changes.hasStaticCasterMoved =
      previous.staticRevision !== this.staticRevision;
    changes.hasStaticBiasChanged =
      previous.staticBiasVersion !== this.staticBiasVersion;
    changes.hasDynamicRosterChanged =
      previous.dynamicVersion !== this.dynamicVersion;
    changes.hasDynamicCasterMoved =
      previous.dynamicRevision !== this.dynamicRevision;
    changes.shouldRequestPages =
      changes.hasViewChanged ||
      changes.hasSunChanged ||
      changes.hasLevelBiasChanged ||
      changes.hasStaticRosterChanged ||
      changes.hasStaticCasterMoved ||
      changes.hasDynamicRosterChanged;

    previous.camera = camera;
    previous.cameraMatrix.copy(camera.matrixWorld);
    previous.projectionMatrix.copy(camera.projectionMatrix);
    previous.drawingBufferSize.copy(this.drawingBufferSize);
    previous.sunDirection.copy(sunDirection);
    if (changes.hasSunChanged)
      computeLightBasis(
        sunDirection,
        this.lightBasis.x.value,
        this.lightBasis.y.value,
      );
    previous.resolutionBias = vsmResolutionBias.value;
    previous.softReceiverLevelBias = vsmSoftReceiverLevelBias.value;
    previous.staticVersion = this.staticVersion;
    previous.staticRevision = this.staticRevision;
    previous.staticBiasVersion = this.staticBiasVersion;
    previous.dynamicVersion = this.dynamicVersion;
    previous.dynamicRevision = this.dynamicRevision;

    this.frame.value = (this.frame.value + 1) >>> 0;
    if (changes.hasSunChanged) this.invalidateAllPages();
  }

  setCamera(camera: Camera) {
    this.projectionMatrixInverse.value = camera.projectionMatrixInverse;
    this.cameraWorldMatrix.value = camera.matrixWorld;
  }

  invalidateAllPages() {
    this.pageGeneration.value = (this.pageGeneration.value + 1) >>> 0;
    if (this.pageGeneration.value === 0) this.pageGeneration.value = 1;
    this.hasPageInvalidation = true;
  }

  takePageInvalidation() {
    const hasPageInvalidation = this.hasPageInvalidation;
    this.hasPageInvalidation = false;
    return hasPageInvalidation;
  }

  takeDirtyStaticBounds() {
    const bounds = this.dirtyStaticBounds;
    this.dirtyStaticBounds = [];
    return bounds;
  }

  resolvePage(pageKey: Node<"uint">, pageTag: Node<"uint">) {
    const entry = this.pageTableNode.element(pageKey);
    const slotPlusOne = entry.x;
    const hasSlot = slotPlusOne
      .greaterThan(0)
      .and(slotPlusOne.lessThanEqual(VSM_POOL_CAPACITY));
    const slot = hasSlot.select(slotPlusOne.sub(1), uint(0));
    const metadata = this.slotMetadataNode.element(slot);
    const isResident = hasSlot
      .and(metadata.x.equal(pageKey))
      .and(metadata.y.equal(pageTag))
      .and(metadata.w.equal(this.pageGeneration));
    const hasDynamic = isResident.and(entry.y.equal(this.frame));
    return { slot, isResident, hasDynamic, dynamicSlot: entry.z };
  }

  registerCaster(mesh: Mesh, options: VSMCasterOptions = {}) {
    if (this.casterEntries.has(mesh))
      throw new Error(`Shadow caster already registered: ${mesh.name}`);
    const { motion = "fixed", depthBias = 0, opacity, gpuInstances } = options;
    const kind = gpuInstances ? "deformed" : motion;
    if (!Number.isFinite(depthBias) || depthBias < 0)
      throw new Error(`Invalid shadow depth bias: ${mesh.name}`);
    if (
      gpuInstances &&
      (!Number.isInteger(gpuInstances.count) ||
        gpuInstances.count <= 0 ||
        !Number.isFinite(gpuInstances.radiusMeters) ||
        gpuInstances.radiusMeters <= 0)
    )
      throw new Error(`Invalid shadow gpu instances: ${mesh.name}`);
    if (kind !== "fixed" && mesh instanceof BatchedMesh)
      throw new Error(`Batched shadow caster must be fixed: ${mesh.name}`);

    const { material } = mesh;
    const alphaTest = material instanceof NodeMaterial ? material.alphaTest : 0;
    if (opacity && alphaTest <= 0)
      throw new Error(`Shadow opacity needs material alphaTest: ${mesh.name}`);

    mesh.updateWorldMatrix(true, false);
    const worldBounds = new Box3().setFromObject(mesh);
    this.casterEntries.set(mesh, {
      mesh,
      kind,
      depthBias,
      opacity,
      alphaTest,
      gpuInstances,
      worldMatrix: mesh.matrixWorld.clone(),
      worldBounds,
    });
    if (kind === "fixed") this.dirtyStaticBounds.push(worldBounds.clone());
    this.casterCounts[kind]++;
    this.bumpRosterVersion(kind);
  }

  unregisterCaster(mesh: Mesh) {
    const entry = this.casterEntries.get(mesh);
    if (!entry) throw new Error(`Shadow caster not registered: ${mesh.name}`);

    this.casterEntries.delete(mesh);
    if (entry.kind === "fixed") this.dirtyStaticBounds.push(entry.worldBounds);
    this.casterCounts[entry.kind]--;
    this.bumpRosterVersion(entry.kind);
  }

  setCasterDepthBias(mesh: Mesh, depthBias: number) {
    const entry = this.casterEntries.get(mesh);
    if (!entry || entry.kind !== "fixed")
      throw new Error(`Fixed shadow caster not registered: ${mesh.name}`);
    if (!Number.isFinite(depthBias) || depthBias < 0)
      throw new Error(`Invalid shadow depth bias: ${mesh.name}`);
    if (entry.depthBias === depthBias) return;
    entry.depthBias = depthBias;
    this.dirtyStaticBounds.push(entry.worldBounds.clone());
    this.staticBiasVersion++;
  }

  markCasterMoved(mesh: Mesh) {
    const entry = this.casterEntries.get(mesh);
    if (!entry) throw new Error(`Shadow caster not registered: ${mesh.name}`);
    mesh.updateWorldMatrix(true, false);
    if (entry.worldMatrix.equals(mesh.matrixWorld)) return;
    entry.worldMatrix.copy(mesh.matrixWorld);
    if (entry.kind === "fixed") {
      this.dirtyStaticBounds.push(entry.worldBounds.clone());
      entry.worldBounds.setFromObject(mesh);
      this.dirtyStaticBounds.push(entry.worldBounds.clone());
      this.staticRevision++;
    }
    if (entry.kind === "moving") this.dynamicRevision++;
  }

  private bumpRosterVersion(kind: VSMCasterKind) {
    if (kind === "fixed") this.staticVersion++;
    else this.dynamicVersion++;
  }
}
