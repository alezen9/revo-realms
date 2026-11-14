import {
  Box3,
  Matrix4,
  Quaternion,
  Vector2,
  Vector3,
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
export const VSM_DYNAMIC_CAPACITY = 128;
export const VSM_INVALID_PAGE_KEY = 0xffffffff;
export const VSM_JOBS_ALLOCATED = 0;
export const VSM_JOBS_ACTIVE = VSM_POOL_CAPACITY;
export const VSM_JOBS_DYNAMIC = VSM_POOL_CAPACITY * 2;
export const VSM_JOB_COUNT = VSM_POOL_CAPACITY * 3;
export const VSM_COUNTER_ALLOCATED = 0;
export const VSM_COUNTER_MISSING = 1;
export const VSM_COUNTER_ACTIVE = 2;
export const VSM_COUNTER_EMPTY = 3;
export const VSM_COUNTER_REUSABLE = 4;
export const VSM_COUNTER_LEVEL_MISSES = 5;
export const VSM_COUNTER_COUNT = VSM_COUNTER_LEVEL_MISSES + VSM_LEVEL_COUNT;
export const VSM_DYNAMIC_COUNTER_TOTAL = 0;
export const VSM_DYNAMIC_COUNTER_LEVEL_COUNTS = 1;
export const VSM_DYNAMIC_COUNTER_LEVEL_CURSORS =
  VSM_DYNAMIC_COUNTER_LEVEL_COUNTS + VSM_LEVEL_COUNT;
export const VSM_DYNAMIC_COUNTER_COUNT =
  VSM_DYNAMIC_COUNTER_LEVEL_CURSORS + VSM_LEVEL_COUNT;

export type VSMCasterOptions = {
  type?: VSMLayerKind;
  depthBias?: number;
  opacityNode?: Node<"float">;
  positionNode?: Node<"vec3">;
};

export type VSMCaster = {
  mesh: Mesh;
  type: VSMLayerKind;
  depthBias: number;
  opacityNode?: Node<"float">;
  positionNode?: Node<"vec3">;
  alphaTest: number;
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

type VSMLayerChanges = {
  hasRosterChanged: boolean;
  hasCasterChanged: boolean;
};

type VSMChanges = Record<VSMLayerKind, VSMLayerChanges> & {
  hasSunChanged: boolean;
  shouldRequestPages: boolean;
};

type LayerVersions = Record<VSMLayerKind, { roster: number; revision: number }>;

type PreviousFrame = {
  camera?: Camera;
  cameraPosition: Vector3;
  cameraQuaternion: Quaternion;
  projectionMatrix: Matrix4;
  drawingBufferSize: Vector2;
  sunDirection: Vector3;
  resolutionBias: number;
  softReceiverLevelBias: number;
  versions: LayerVersions;
};

const VSM_LAYER_KINDS: VSMLayerKind[] = ["static", "dynamic"];

const CAMERA_MOVE_EPSILON_SQUARED = 0.002 ** 2;
const CAMERA_TURN_EPSILON = 0.0005;
const CAMERA_TURN_DOT_THRESHOLD = 1 - Math.cos(CAMERA_TURN_EPSILON / 2);

const initialSlotMetadata = new Uint32Array(VSM_POOL_CAPACITY * 4);
for (let slot = 0; slot < VSM_POOL_CAPACITY; slot++)
  initialSlotMetadata[slot * 4] = VSM_INVALID_PAGE_KEY;

export class VSMContext {
  readonly changes: VSMChanges = {
    hasSunChanged: true,
    shouldRequestPages: true,
    static: { hasRosterChanged: true, hasCasterChanged: true },
    dynamic: { hasRosterChanged: true, hasCasterChanged: true },
  };
  readonly frame = uniform(0, "uint");
  readonly pageGeneration = uniform(1, "uint");
  readonly cameraWorldPosition = new Vector3();
  private cameraWorldQuaternion = new Quaternion();
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
  readonly slotMetadata = new StorageBufferAttribute(initialSlotMetadata, 4);
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
  readonly staticBoundsToRedraw: Box3[] = [];
  private hasPageInvalidation = true;
  private versions: LayerVersions = {
    static: { roster: 0, revision: 0 },
    dynamic: { roster: 0, revision: 0 },
  };
  private previous: PreviousFrame = {
    cameraPosition: new Vector3(),
    cameraQuaternion: new Quaternion(),
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
    this.pageTable.name = "VSM page table";
    this.slotMetadata.name = "VSM slot metadata";
    this.slotRenderFrames.name = "VSM slot render frames";
    this.pageJobs.name = "VSM page jobs";
    this.counters.name = "VSM counters";
    this.dynamicCounters.name = "VSM dynamic counters";
  }

  get casters() {
    return this.casterEntries.values();
  }

  beginFrame(camera: Camera, sunDirection: Vector3) {
    const { previous, changes } = this;
    this.renderer.getDrawingBufferSize(this.drawingBufferSize);
    camera.getWorldPosition(this.cameraWorldPosition);
    camera.getWorldQuaternion(this.cameraWorldQuaternion);
    const hasCameraMoved =
      this.cameraWorldPosition.distanceToSquared(previous.cameraPosition) >
      CAMERA_MOVE_EPSILON_SQUARED;
    const hasCameraTurned =
      1 - Math.abs(this.cameraWorldQuaternion.dot(previous.cameraQuaternion)) >
      CAMERA_TURN_DOT_THRESHOLD;
    const hasViewChanged =
      camera !== previous.camera ||
      hasCameraMoved ||
      hasCameraTurned ||
      !previous.projectionMatrix.equals(camera.projectionMatrix) ||
      !previous.drawingBufferSize.equals(this.drawingBufferSize);
    const hasLevelBiasChanged =
      previous.resolutionBias !== vsmResolutionBias.value ||
      previous.softReceiverLevelBias !== vsmSoftReceiverLevelBias.value;
    changes.hasSunChanged = !previous.sunDirection.equals(sunDirection);
    for (const entry of this.casterEntries.values()) {
      const { mesh, worldMatrix, worldBounds } = entry;
      mesh.updateWorldMatrix(true, false);
      if (worldMatrix.equals(mesh.matrixWorld)) continue;
      worldMatrix.copy(mesh.matrixWorld);
      if (entry.type === "dynamic") {
        this.versions.dynamic.revision++;
        continue;
      }
      this.staticBoundsToRedraw.push(worldBounds.clone());
      worldBounds.setFromObject(mesh);
      this.staticBoundsToRedraw.push(worldBounds.clone());
      this.versions.static.revision++;
    }
    for (const kind of VSM_LAYER_KINDS) {
      const current = this.versions[kind];
      const last = previous.versions[kind];
      changes[kind].hasRosterChanged = last.roster !== current.roster;
      changes[kind].hasCasterChanged = last.revision !== current.revision;
      last.roster = current.roster;
      last.revision = current.revision;
    }
    changes.shouldRequestPages =
      hasViewChanged ||
      changes.hasSunChanged ||
      hasLevelBiasChanged ||
      changes.static.hasRosterChanged ||
      changes.static.hasCasterChanged ||
      changes.dynamic.hasRosterChanged;

    previous.camera = camera;
    if (hasViewChanged) {
      previous.cameraPosition.copy(this.cameraWorldPosition);
      previous.cameraQuaternion.copy(this.cameraWorldQuaternion);
    }
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

  clearStaticBoundsToRedraw() {
    this.staticBoundsToRedraw.length = 0;
  }

  resolvePage(pageKey: Node<"uint">, pageTag: Node<"uint">) {
    const {
      x: staticSlotPlusOne,
      y: touchedFrame,
      z: dynamicSlot,
    } = this.pageTableNode.element(pageKey);
    const hasSlot = staticSlotPlusOne
      .greaterThan(0)
      .and(staticSlotPlusOne.lessThanEqual(VSM_POOL_CAPACITY));
    const slot = hasSlot.select(staticSlotPlusOne.sub(1), uint(0));
    const {
      x: slotPageKey,
      y: slotPageTag,
      w: slotGeneration,
    } = this.slotMetadataNode.element(slot);
    const isResident = hasSlot
      .and(slotPageKey.equal(pageKey))
      .and(slotPageTag.equal(pageTag))
      .and(slotGeneration.equal(this.pageGeneration));
    const hasDynamic = isResident.and(touchedFrame.equal(this.frame));
    return { slot, isResident, hasDynamic, dynamicSlot };
  }

  registerCaster(mesh: Mesh, options: VSMCasterOptions = {}) {
    if (this.casterEntries.has(mesh))
      throw new Error(`Shadow caster already registered: ${mesh.name}`);
    const {
      type = "static",
      depthBias = 0,
      opacityNode,
      positionNode,
    } = options;
    if (!Number.isFinite(depthBias) || depthBias < 0)
      throw new Error(`Invalid shadow depth bias: ${mesh.name}`);
    if (positionNode && type !== "dynamic")
      throw new Error(
        `Shadow position node needs a dynamic caster: ${mesh.name}`,
      );
    if (type !== "static" && mesh instanceof BatchedMesh)
      throw new Error(`Batched shadow caster must be static: ${mesh.name}`);

    const { material } = mesh;
    let alphaTest = 0;
    if (material instanceof NodeMaterial) alphaTest = material.alphaTest;
    if (opacityNode && alphaTest <= 0)
      throw new Error(`Shadow opacity needs material alphaTest: ${mesh.name}`);

    mesh.updateWorldMatrix(true, false);
    const worldBounds = new Box3().setFromObject(mesh);
    const hasFiniteBounds = [
      ...worldBounds.min.toArray(),
      ...worldBounds.max.toArray(),
    ].every(Number.isFinite);
    if (!hasFiniteBounds)
      throw new Error(`Shadow caster has non-finite bounds: ${mesh.name}`);
    this.casterEntries.set(mesh, {
      mesh,
      type,
      depthBias,
      opacityNode,
      positionNode,
      alphaTest,
      worldMatrix: mesh.matrixWorld.clone(),
      worldBounds,
    });
    if (type === "static") this.staticBoundsToRedraw.push(worldBounds.clone());
    this.versions[type].roster++;
  }

  unregisterCaster(mesh: Mesh) {
    const entry = this.casterEntries.get(mesh);
    if (!entry) throw new Error(`Shadow caster not registered: ${mesh.name}`);

    this.casterEntries.delete(mesh);
    if (entry.type === "static")
      this.staticBoundsToRedraw.push(entry.worldBounds);
    this.versions[entry.type].roster++;
  }

  setCasterDepthBias(mesh: Mesh, depthBias: number) {
    const entry = this.casterEntries.get(mesh);
    if (!entry || entry.type !== "static")
      throw new Error(`Static shadow caster not registered: ${mesh.name}`);
    if (!Number.isFinite(depthBias) || depthBias < 0)
      throw new Error(`Invalid shadow depth bias: ${mesh.name}`);
    if (entry.depthBias === depthBias) return;
    entry.depthBias = depthBias;
    this.staticBoundsToRedraw.push(entry.worldBounds.clone());
    this.versions.static.revision++;
  }
}
