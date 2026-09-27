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

export const VSM_POOL_CAPACITY = 512;
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

export type VSMCasterKind = "static" | "dynamic" | "deformed";

export type VSMGpuInstances = {
  count: number;
  radiusMeters: number;
  geometry?: BufferGeometry;
  basePositionNode: Node<"vec3">;
  heightNode: Node<"float">;
  positionNode: Node<"vec3">;
  isActiveNode: Node<"bool">;
};

export type VSMCasterOptions = {
  type?: "static" | "dynamic";
  depthBias?: number;
  opacityNode?: Node<"float">;
  gpuInstances?: VSMGpuInstances;
};

export type VSMCaster = {
  mesh: Mesh;
  kind: VSMCasterKind;
  depthBias: number;
  opacityNode?: Node<"float">;
  alphaTest: number;
  gpuInstances?: VSMGpuInstances;
  worldMatrix: Matrix4;
  worldBounds: Box3;
};

export type VSMJobSource = {
  offset: number;
  countAttribute: StorageBufferAttribute;
  countIndex: number;
  countLength: number;
};

export type VSMLayerKind = "static" | "dynamic";

export type VSMLayerChanges = {
  hasRosterChanged: boolean;
  hasCasterMoved: boolean;
};

export type VSMChanges = Record<VSMLayerKind, VSMLayerChanges> & {
  hasSunChanged: boolean;
  shouldRequestPages: boolean;
};

type LayerVersions = Record<VSMLayerKind, { roster: number; revision: number }>;

type PreviousFrame = {
  camera?: Camera;
  cameraMatrix: Matrix4;
  projectionMatrix: Matrix4;
  drawingBufferSize: Vector2;
  sunDirection: Vector3;
  resolutionBias: number;
  softReceiverLevelBias: number;
  versions: LayerVersions;
};

const VSM_LAYER_KINDS: VSMLayerKind[] = ["static", "dynamic"];

const CAMERA_MOVE_EPSILON = 0.002;
const CAMERA_TURN_EPSILON = 0.0005;
const ROTATION_ELEMENTS = [0, 1, 2, 4, 5, 6, 8, 9, 10];

const hasCameraMoved = (previous: Matrix4, current: Matrix4) => {
  const { elements: before } = previous;
  const { elements: after } = current;
  for (const index of ROTATION_ELEMENTS)
    if (Math.abs(after[index] - before[index]) > CAMERA_TURN_EPSILON)
      return true;
  return (
    Math.hypot(
      after[12] - before[12],
      after[13] - before[13],
      after[14] - before[14],
    ) > CAMERA_MOVE_EPSILON
  );
};

const getLayerKind = (kind: VSMCasterKind): VSMLayerKind =>
  kind === "static" ? "static" : "dynamic";

const initialMetadata = new Uint32Array(VSM_POOL_CAPACITY * 4);
for (let slot = 0; slot < VSM_POOL_CAPACITY; slot++)
  initialMetadata[slot * 4] = VSM_INVALID_PAGE_KEY;

export class VSMContext {
  readonly casterCounts = { static: 0, dynamic: 0, deformed: 0 };
  readonly changes: VSMChanges = {
    hasSunChanged: true,
    shouldRequestPages: true,
    static: { hasRosterChanged: true, hasCasterMoved: true },
    dynamic: { hasRosterChanged: true, hasCasterMoved: true },
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
  readonly allocatedJobs: VSMJobSource = {
    offset: VSM_JOBS_ALLOCATED,
    countAttribute: this.counters,
    countIndex: VSM_COUNTER_ALLOCATED,
    countLength: VSM_COUNTER_COUNT,
  };
  readonly dynamicJobs: VSMJobSource = {
    offset: VSM_JOBS_DYNAMIC,
    countAttribute: this.dynamicCounters,
    countIndex: VSM_DYNAMIC_COUNTER_TOTAL,
    countLength: VSM_DYNAMIC_COUNTER_COUNT,
  };
  private renderer: WebGPURenderer;
  private casterEntries = new Map<Mesh, VSMCaster>();
  private dirtyStaticBounds: Box3[] = [];
  private hasPageInvalidation = true;
  private versions: LayerVersions = {
    static: { roster: 0, revision: 0 },
    dynamic: { roster: 0, revision: 0 },
  };
  private previous: PreviousFrame = {
    cameraMatrix: new Matrix4(),
    projectionMatrix: new Matrix4(),
    drawingBufferSize: new Vector2(),
    sunDirection: new Vector3(),
    resolutionBias: -1,
    softReceiverLevelBias: -1,
    versions: {
      static: { roster: -1, revision: -1 },
      dynamic: { roster: -1, revision: -1 },
    },
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
    const hasViewChanged =
      camera !== previous.camera ||
      hasCameraMoved(previous.cameraMatrix, camera.matrixWorld) ||
      !previous.projectionMatrix.equals(camera.projectionMatrix) ||
      !previous.drawingBufferSize.equals(this.drawingBufferSize);
    const hasLevelBiasChanged =
      previous.resolutionBias !== vsmResolutionBias.value ||
      previous.softReceiverLevelBias !== vsmSoftReceiverLevelBias.value;
    changes.hasSunChanged = !previous.sunDirection.equals(sunDirection);
    for (const entry of this.casterEntries.values()) {
      if (entry.kind === "deformed") continue;
      const { mesh, worldMatrix, worldBounds } = entry;
      mesh.updateWorldMatrix(true, false);
      if (worldMatrix.equals(mesh.matrixWorld)) continue;
      worldMatrix.copy(mesh.matrixWorld);
      if (entry.kind === "dynamic") {
        this.versions.dynamic.revision++;
        continue;
      }
      this.dirtyStaticBounds.push(worldBounds.clone());
      worldBounds.setFromObject(mesh);
      this.dirtyStaticBounds.push(worldBounds.clone());
      this.versions.static.revision++;
    }
    for (const kind of VSM_LAYER_KINDS) {
      const current = this.versions[kind];
      const last = previous.versions[kind];
      changes[kind].hasRosterChanged = last.roster !== current.roster;
      changes[kind].hasCasterMoved = last.revision !== current.revision;
      last.roster = current.roster;
      last.revision = current.revision;
    }
    changes.shouldRequestPages =
      hasViewChanged ||
      changes.hasSunChanged ||
      hasLevelBiasChanged ||
      changes.static.hasRosterChanged ||
      changes.static.hasCasterMoved ||
      changes.dynamic.hasRosterChanged;

    previous.camera = camera;
    if (hasViewChanged) previous.cameraMatrix.copy(camera.matrixWorld);
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
    const {
      type = "static",
      depthBias = 0,
      opacityNode,
      gpuInstances,
    } = options;
    const kind = gpuInstances ? "deformed" : type;
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
    if (kind !== "static" && mesh instanceof BatchedMesh)
      throw new Error(`Batched shadow caster must be static: ${mesh.name}`);

    const { material } = mesh;
    const alphaTest = material instanceof NodeMaterial ? material.alphaTest : 0;
    if (opacityNode && alphaTest <= 0)
      throw new Error(`Shadow opacity needs material alphaTest: ${mesh.name}`);

    mesh.updateWorldMatrix(true, false);
    const worldBounds = new Box3().setFromObject(mesh);
    this.casterEntries.set(mesh, {
      mesh,
      kind,
      depthBias,
      opacityNode,
      alphaTest,
      gpuInstances,
      worldMatrix: mesh.matrixWorld.clone(),
      worldBounds,
    });
    if (kind === "static") this.dirtyStaticBounds.push(worldBounds.clone());
    this.casterCounts[kind]++;
    this.versions[getLayerKind(kind)].roster++;
  }

  unregisterCaster(mesh: Mesh) {
    const entry = this.casterEntries.get(mesh);
    if (!entry) throw new Error(`Shadow caster not registered: ${mesh.name}`);

    this.casterEntries.delete(mesh);
    if (entry.kind === "static") this.dirtyStaticBounds.push(entry.worldBounds);
    this.casterCounts[entry.kind]--;
    this.versions[getLayerKind(entry.kind)].roster++;
  }

  setCasterDepthBias(mesh: Mesh, depthBias: number) {
    const entry = this.casterEntries.get(mesh);
    if (!entry || entry.kind !== "static")
      throw new Error(`Static shadow caster not registered: ${mesh.name}`);
    if (!Number.isFinite(depthBias) || depthBias < 0)
      throw new Error(`Invalid shadow depth bias: ${mesh.name}`);
    if (entry.depthBias === depthBias) return;
    entry.depthBias = depthBias;
    this.dirtyStaticBounds.push(entry.worldBounds.clone());
    this.versions.static.revision++;
  }
}
