import {
  Box3,
  BufferGeometry,
  DepthTexture,
  DoubleSide,
  Float32BufferAttribute,
  FloatType,
  LessEqualCompare,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  RedFormat,
  Scene,
  UnsignedByteType,
  Vector3,
} from "three";
import {
  BatchedMesh,
  MeshBasicNodeMaterial,
  RenderTarget,
  type Node,
  type WebGPURenderer,
} from "three/webgpu";
import {
  attribute,
  float,
  Fn,
  If,
  instanceIndex,
  mix,
  positionGeometry,
  storage,
  texture,
  uniform,
  uint,
  uvec2,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type {
  ShadowCasterEntry,
  ShadowCasterRegistry,
} from "./ShadowCasterRegistry";
import { ShadowRigidCasterBucket } from "./ShadowRigidCasterBucket";
import { ShadowPineCasterBucket } from "./ShadowPineCasterBucket";
import { ShadowDeformedCasterBucket } from "./ShadowDeformedCasterBucket";
import {
  decodeGpuShadowPageKey,
  SHADOW_PAGE_GRID_MIN,
  SHADOW_PAGE_GRID_SIZE,
  SHADOW_FAR_START,
  SHADOW_NEAR_END,
  SHADOW_PAGES_PER_LEVEL,
  SHADOW_PAGE_WORLD_SIZE,
  getGpuShadowPageAddress,
} from "./ShadowPageCoordinates";
import type { ShadowResidency } from "./ShadowResidency";

export const SHADOW_RIGID_PAGE_TEXELS = 320;
const DEPTH_BIAS = 0.0015;

export class ShadowRigidAtlas {
  private renderer: WebGPURenderer;
  private residency: ShadowResidency;
  private sunDirection: Node<"vec3">;
  private kind: "fixed" | "moving";
  private atlasGridSize: number;
  private renderTarget: RenderTarget;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private pageJobsNode;
  private pageJobOffset: number;
  private minimumY = uniform(-8);
  private maximumY = uniform(64);
  private sources: ShadowCasterEntry[] = [];
  private bucket?: ShadowRigidCasterBucket;
  private casterMesh?: Mesh;
  private batchedCasters: {
    entry: ShadowCasterEntry;
    source: BatchedMesh;
    bucket: ShadowPineCasterBucket;
    mesh: Mesh;
  }[] = [];
  private deformedCasters: {
    entry: ShadowCasterEntry;
    bucket: ShadowDeformedCasterBucket;
    mesh: Mesh;
  }[] = [];
  private registryVersion = -1;
  private movingRevision = -1;
  private fixedRevision = -1;
  private biasVersion = -1;
  private previousSunDirection = new Vector3();
  private bounds = new Box3();
  private isTargetInitialized = false;
  private isReady = uniform(0);
  private depthTextureNode;

  constructor(
    renderer: WebGPURenderer,
    residency: ShadowResidency,
    sunDirection: Node<"vec3">,
    kind: "fixed" | "moving",
  ) {
    this.renderer = renderer;
    this.residency = residency;
    this.sunDirection = sunDirection;
    this.kind = kind;
    this.pageJobOffset = kind === "fixed" ? 0 : residency.capacity;
    this.atlasGridSize = Math.ceil(Math.sqrt(residency.capacity));
    const atlasSize = this.atlasGridSize * SHADOW_RIGID_PAGE_TEXELS;
    this.renderTarget = new RenderTarget(atlasSize, atlasSize, {
      depthBuffer: true,
      format: RedFormat,
      samples: 0,
      stencilBuffer: false,
      type: UnsignedByteType,
    });
    this.renderTarget.texture.name = `V2 ${kind} depth debug`;
    this.renderTarget.texture.magFilter = NearestFilter;
    this.renderTarget.texture.minFilter = NearestFilter;
    const depthTexture = new DepthTexture(atlasSize, atlasSize, FloatType);
    depthTexture.compareFunction = LessEqualCompare;
    depthTexture.magFilter = LinearFilter;
    depthTexture.minFilter = LinearFilter;
    depthTexture.name = `V2 ${kind} depth`;
    this.renderTarget.depthTexture = depthTexture;
    this.depthTextureNode = texture(depthTexture);
    this.pageJobsNode = storage(
      residency.pageJobsAttribute,
      "uvec2",
      residency.capacity * 2,
    );
    this.scene.add(this.createClearMesh());
  }

  syncCasters(
    registry: ShadowCasterRegistry,
    sunDirection: Vector3,
    terrainBounds: { min: number; max: number },
  ) {
    const registryVersion =
      this.kind === "fixed"
        ? registry.fixedVersion
        : registry.movingVersion + registry.deformedVersion;
    const hasRosterChange = registryVersion !== this.registryVersion;
    const hasSunChange = !this.previousSunDirection.equals(sunDirection);
    const hasBiasChange =
      this.kind === "fixed" && registry.biasVersion !== this.biasVersion;
    const hasMovement =
      this.kind === "fixed"
        ? registry.fixedRevision !== this.fixedRevision
        : registry.movingRevision !== this.movingRevision;
    if (!hasRosterChange && !hasSunChange && !hasBiasChange && !hasMovement)
      return;

    this.previousSunDirection.copy(sunDirection);
    this.biasVersion = registry.biasVersion;
    this.movingRevision = registry.movingRevision;
    this.fixedRevision = registry.fixedRevision;
    if (hasRosterChange) {
      this.registryVersion = registryVersion;
      this.sources = [];
      for (const { mesh, bucket } of this.batchedCasters) {
        this.scene.remove(mesh);
        bucket.dispose();
      }
      this.batchedCasters = [];
      for (const { mesh, bucket } of this.deformedCasters) {
        this.scene.remove(mesh);
        bucket.dispose();
      }
      this.deformedCasters = [];
      for (const entry of registry.casters) {
        if (
          entry.kind === this.kind &&
          !(entry.mesh instanceof BatchedMesh) &&
          !entry.deformedInstances
        )
          this.sources.push(entry);
        if (
          this.kind === "moving" &&
          entry.deformedInstances &&
          !entry.localVegetation
        ) {
          const bucket = new ShadowDeformedCasterBucket(
            this.renderer,
            this.residency,
            entry.mesh,
            entry.deformedInstances,
            this.sunDirection,
            entry.depthBiasMeters,
          );
          const mesh = new Mesh(
            bucket.geometry,
            this.createDeformedCasterMaterial(bucket, entry),
          );
          mesh.frustumCulled = false;
          mesh.renderOrder = 3;
          this.scene.add(mesh);
          this.deformedCasters.push({ entry, bucket, mesh });
        }
        if (
          entry.mesh instanceof BatchedMesh &&
          (entry.kind === this.kind ||
            (this.kind === "moving" && entry.kind === "deformed"))
        ) {
          const bucket = new ShadowPineCasterBucket(
            this.renderer,
            this.residency,
            entry.mesh,
            this.kind,
            entry.depthBiasMeters,
          );
          const mesh = new Mesh(
            bucket.geometry,
            this.createBatchedCasterMaterial(bucket, entry),
          );
          mesh.frustumCulled = false;
          mesh.renderOrder = 2;
          this.scene.add(mesh);
          this.batchedCasters.push({ entry, source: entry.mesh, bucket, mesh });
        }
      }
      if (this.casterMesh) this.scene.remove(this.casterMesh);
      this.bucket?.dispose();
      this.bucket = undefined;
      this.casterMesh = undefined;
      if (this.sources.length > 0) {
        this.bucket = new ShadowRigidCasterBucket(
          this.residency,
          this.sources,
          this.kind,
        );
        this.casterMesh = new Mesh(
          this.bucket.geometry,
          this.createCasterMaterial(this.bucket),
        );
        this.casterMesh.frustumCulled = false;
        this.casterMesh.renderOrder = 1;
        this.scene.add(this.casterMesh);
      } else {
        if (this.kind === "fixed") this.residency.setFixedVertexCount(0);
        else this.residency.setMovingVertexCount(0);
      }
    }

    if (hasBiasChange && !hasRosterChange && !hasSunChange && !hasMovement) {
      this.bucket?.updateBiases(this.sources);
      for (const { entry, bucket } of this.batchedCasters)
        bucket.depthBiasMeters.value = entry.depthBiasMeters;
      this.residency.invalidate();
      return;
    }

    let minimumY = terrainBounds.min - 8;
    let maximumY = terrainBounds.max + 64;
    for (const { mesh } of this.sources) {
      this.bounds.setFromObject(mesh, true);
      minimumY = Math.min(minimumY, this.bounds.min.y);
      maximumY = Math.max(maximumY, this.bounds.max.y);
    }
    for (const { entry, source, bucket } of this.batchedCasters) {
      if (hasRosterChange || hasSunChange)
        bucket.update(
          source,
          sunDirection,
          entry.maxVerticalDisplacementMeters,
        );
      minimumY = Math.min(minimumY, bucket.bounds.min.y);
      maximumY = Math.max(maximumY, bucket.bounds.max.y);
    }
    this.minimumY.value = Math.floor(minimumY);
    this.maximumY.value = Math.ceil(maximumY);
    this.bucket?.update(this.sources, sunDirection);
    if (this.kind === "fixed" && (hasRosterChange || hasMovement))
      this.residency.invalidate();
  }

  render() {
    if (
      !this.bucket &&
      this.batchedCasters.length === 0 &&
      this.deformedCasters.length === 0
    )
      return;
    for (const { bucket } of this.batchedCasters) bucket.run();
    for (const { bucket } of this.deformedCasters) bucket.run();
    const previousTarget = this.renderer.getRenderTarget();
    const wasAutoClearEnabled = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.setRenderTarget(this.renderTarget);
    try {
      if (!this.isTargetInitialized) {
        this.renderer.clear(true, true, false);
        this.isTargetInitialized = true;
      }
      this.renderer.render(this.scene, this.camera);
      this.isReady.value = 1;
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      this.renderer.autoClear = wasAutoClearEnabled;
    }
  }

  sampleDebugDepth(slot: Node<"uint">, pageUv: Node<"vec2">) {
    const atlasUv = this.computeAtlasUv(slot, pageUv);
    return texture(this.renderTarget.texture).sample(atlasUv).r;
  }

  computeVisibility(
    worldPosition: Node<"vec3">,
    sceneDepth: Node<"float">,
    viewDepth: Node<"float">,
    secondary?: ShadowRigidAtlas,
  ) {
    return Fn(() => {
      const visibility = float(1).toVar();
      const nearVisibility = float(1).toVar();
      const hasNearPage = uint(0).toVar();
      If(viewDepth.lessThan(SHADOW_NEAR_END), () => {
        const near = this.lookupPage(
          worldPosition,
          sceneDepth,
          uint(0),
          secondary,
        );
        If(near.isValid, () => {
          nearVisibility.assign(near.visibility);
          visibility.assign(near.visibility);
          hasNearPage.assign(1);
        });
      });
      If(viewDepth.greaterThanEqual(SHADOW_FAR_START), () => {
        const far = this.lookupPage(
          worldPosition,
          sceneDepth,
          uint(1),
          secondary,
        );
        If(far.isValid, () => {
          const blend = viewDepth
            .sub(SHADOW_FAR_START)
            .div(SHADOW_NEAR_END - SHADOW_FAR_START)
            .clamp();
          visibility.assign(
            hasNearPage
              .greaterThan(0)
              .select(
                mix(nearVisibility, far.visibility, blend),
                far.visibility,
              ),
          );
        });
      });
      return visibility;
    })();
  }

  private lookupPage(
    worldPosition: Node<"vec3">,
    sceneDepth: Node<"float">,
    level: Node<"uint">,
    secondary?: ShadowRigidAtlas,
  ) {
    const address = getGpuShadowPageAddress(
      worldPosition,
      this.sunDirection,
      level,
    );
    const topLeft = this.sampleTap(
      address,
      worldPosition,
      sceneDepth,
      level,
      vec2(-0.75, -0.75),
      secondary,
    );
    const topRight = this.sampleTap(
      address,
      worldPosition,
      sceneDepth,
      level,
      vec2(0.75, -0.75),
      secondary,
    );
    const bottomLeft = this.sampleTap(
      address,
      worldPosition,
      sceneDepth,
      level,
      vec2(-0.75, 0.75),
      secondary,
    );
    const bottomRight = this.sampleTap(
      address,
      worldPosition,
      sceneDepth,
      level,
      vec2(0.75, 0.75),
      secondary,
    );
    const topLeftWeight = topLeft.isValid.select(float(1), float(0));
    const topRightWeight = topRight.isValid.select(float(1), float(0));
    const bottomLeftWeight = bottomLeft.isValid.select(float(1), float(0));
    const bottomRightWeight = bottomRight.isValid.select(float(1), float(0));
    const weight = topLeftWeight
      .add(topRightWeight)
      .add(bottomLeftWeight)
      .add(bottomRightWeight);
    const visibility = topLeft.visibility
      .mul(topLeftWeight)
      .add(topRight.visibility.mul(topRightWeight))
      .add(bottomLeft.visibility.mul(bottomLeftWeight))
      .add(bottomRight.visibility.mul(bottomRightWeight))
      .div(weight.max(1));
    return { isValid: weight.greaterThan(0), visibility };
  }

  private sampleTap(
    address: ReturnType<typeof getGpuShadowPageAddress>,
    worldPosition: Node<"vec3">,
    sceneDepth: Node<"float">,
    level: Node<"uint">,
    texelOffset: Node<"vec2">,
    secondary?: ShadowRigidAtlas,
  ) {
    const pagePosition = address.pageId
      .add(address.pageUv)
      .add(texelOffset.div(SHADOW_RIGID_PAGE_TEXELS));
    const pageId = pagePosition.floor();
    const isInsideGrid = pageId.x
      .greaterThanEqual(SHADOW_PAGE_GRID_MIN)
      .and(pageId.y.greaterThanEqual(SHADOW_PAGE_GRID_MIN))
      .and(pageId.x.lessThan(SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE))
      .and(pageId.y.lessThan(SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE));
    const boundedPageId = pageId.clamp(
      SHADOW_PAGE_GRID_MIN,
      SHADOW_PAGE_GRID_MIN + SHADOW_PAGE_GRID_SIZE - 1,
    );
    const pageKey = level.mul(SHADOW_PAGES_PER_LEVEL).add(
      uint(boundedPageId.y.sub(SHADOW_PAGE_GRID_MIN))
        .mul(SHADOW_PAGE_GRID_SIZE)
        .add(uint(boundedPageId.x.sub(SHADOW_PAGE_GRID_MIN))),
    );
    const { slot, isResident, isActive } = this.residency.resolvePage(pageKey);
    const halfTexel = 0.5 / SHADOW_RIGID_PAGE_TEXELS;
    const pageUv = pagePosition.fract().clamp(halfTexel, 1 - halfTexel);
    const atlasUv = this.computeAtlasUv(slot, pageUv);
    const receiverDepth = this.maximumY
      .sub(worldPosition.y)
      .div(this.maximumY.sub(this.minimumY));
    let visibility = this.depthTextureNode
      .sample(atlasUv)
      .compare(receiverDepth.sub(DEPTH_BIAS));
    if (secondary)
      visibility = visibility.mul(
        secondary.sampleVisibility(slot, pageUv, worldPosition, isActive),
      );
    const isValid = this.isReady
      .greaterThan(0)
      .and(sceneDepth.lessThan(1))
      .and(worldPosition.y.greaterThanEqual(this.minimumY))
      .and(worldPosition.y.lessThanEqual(this.maximumY))
      .and(this.sunDirection.y.lessThan(-0.25))
      .and(isInsideGrid)
      .and(this.kind === "fixed" ? isResident : isActive);
    return { isValid, visibility };
  }

  private sampleVisibility(
    slot: Node<"uint">,
    pageUv: Node<"vec2">,
    worldPosition: Node<"vec3">,
    isActive: Node<"bool">,
  ) {
    const receiverDepth = this.maximumY
      .sub(worldPosition.y)
      .div(this.maximumY.sub(this.minimumY));
    const visibility = this.depthTextureNode
      .sample(this.computeAtlasUv(slot, pageUv))
      .compare(receiverDepth.sub(DEPTH_BIAS));
    return isActive
      .and(this.isReady.greaterThan(0))
      .and(worldPosition.y.greaterThanEqual(this.minimumY))
      .and(worldPosition.y.lessThanEqual(this.maximumY))
      .select(visibility, float(1));
  }

  private computeAtlasUv(slot: Node<"uint">, pageUv: Node<"vec2">) {
    const tile = vec2(
      float(slot.mod(this.atlasGridSize)),
      float(slot.div(this.atlasGridSize)),
    );
    return tile.add(pageUv).div(this.atlasGridSize);
  }

  private createClearMesh() {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(
        [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0],
        3,
      ),
    );
    geometry.setIndirect(this.residency.clearIndirectAttribute, [
      (this.kind === "fixed" ? 0 : 8) * Uint32Array.BYTES_PER_ELEMENT,
    ]);
    const material = new MeshBasicNodeMaterial();
    material.depthTest = false;
    material.depthWrite = true;
    material.side = DoubleSide;
    material.depthNode = float(1);
    material.vertexNode = Fn(() => {
      const slot = this.pageJobsNode.element(
        instanceIndex.add(this.pageJobOffset),
      ).y;
      const pageUv = positionGeometry.xy.mul(0.5).add(0.5);
      const atlasUv = this.computeAtlasUv(slot, pageUv);
      return vec4(atlasUv.x.mul(2).sub(1), atlasUv.y.mul(-2).add(1), 1, 1);
    })();
    material.fragmentNode = vec4(1);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  private createBatchedCasterMaterial(
    bucket: ShadowPineCasterBucket,
    entry: ShadowCasterEntry,
  ) {
    if (this.kind === "moving" && !entry.shadowPositionNode)
      throw new Error("Deformed shadow caster needs positionNode");
    const workItems = storage(
      bucket.workItemsAttribute,
      "uvec4",
      bucket.workItemsAttribute.count,
    );
    const matrices = storage(
      bucket.matrixColumnsAttribute,
      "vec4",
      bucket.matrixColumnsAttribute.count,
    );
    const material = new MeshBasicNodeMaterial();
    material.depthTest = true;
    material.depthWrite = true;
    material.side = DoubleSide;
    material.vertexNode = Fn(() => {
      const workItem = workItems.element(instanceIndex);
      const matrixOffset = workItem.z.mul(4);
      const localPosition = vec3(
        this.kind === "moving" && entry.shadowPositionNode
          ? entry.shadowPositionNode
          : positionGeometry,
      );
      const worldPosition = matrices
        .element(matrixOffset)
        .mul(localPosition.x)
        .add(matrices.element(matrixOffset.add(1)).mul(localPosition.y))
        .add(matrices.element(matrixOffset.add(2)).mul(localPosition.z))
        .add(matrices.element(matrixOffset.add(3))).xyz;
      const { level, pageId } = decodeGpuShadowPageKey(workItem.x);
      const horizontalLength = this.sunDirection.xz.length();
      const lightX = horizontalLength
        .lessThan(0.0001)
        .select(
          vec3(1, 0, 0),
          vec3(this.sunDirection.z, 0, this.sunDirection.x.negate()).div(
            horizontalLength.max(0.0001),
          ),
        );
      const lightY = this.sunDirection.cross(lightX).normalize();
      const lightPosition = vec2(
        worldPosition.dot(lightX),
        worldPosition.dot(lightY),
      );
      const pageSize = level
        .equal(0)
        .select(
          float(SHADOW_PAGE_WORLD_SIZE),
          float(SHADOW_PAGE_WORLD_SIZE * 2),
        );
      const pageUv = lightPosition.div(pageSize).sub(pageId);
      varyingProperty("vec2", "pinePageUv").assign(pageUv);
      const depth = this.maximumY
        .sub(worldPosition.y)
        .add(bucket.depthBiasMeters)
        .div(this.maximumY.sub(this.minimumY));
      varyingProperty("float", "pineDepth").assign(depth);
      const atlasUv = this.computeAtlasUv(workItem.y, pageUv);
      return vec4(atlasUv.x.mul(2).sub(1), atlasUv.y.mul(-2).add(1), depth, 1);
    })();
    material.fragmentNode = Fn(() => {
      const pageUv = varyingProperty("vec2", "pinePageUv");
      pageUv.x
        .lessThan(0)
        .or(pageUv.y.lessThan(0))
        .or(pageUv.x.greaterThan(1))
        .or(pageUv.y.greaterThan(1))
        .discard();
      if (entry.shadowOpacityNode && entry.alphaCutoff > 0)
        entry.shadowOpacityNode.lessThan(entry.alphaCutoff).discard();
      return vec4(varyingProperty("float", "pineDepth"), 0, 0, 1);
    })();
    return material;
  }

  private createDeformedCasterMaterial(
    bucket: ShadowDeformedCasterBucket,
    entry: ShadowCasterEntry,
  ) {
    const workItems = storage(
      bucket.workItemsAttribute,
      "uvec4",
      bucket.workItemsAttribute.count,
    );
    const material = new MeshBasicNodeMaterial();
    material.depthTest = true;
    material.depthWrite = true;
    material.side = DoubleSide;
    material.vertexNode = Fn(() => {
      const workItem = workItems.element(instanceIndex);
      const worldPosition = bucket.instances.worldPosition(
        workItem.z,
        positionGeometry,
      );
      const { level, pageId } = decodeGpuShadowPageKey(workItem.x);
      const horizontalLength = this.sunDirection.xz.length();
      const lightX = horizontalLength
        .lessThan(0.0001)
        .select(
          vec3(1, 0, 0),
          vec3(this.sunDirection.z, 0, this.sunDirection.x.negate()).div(
            horizontalLength.max(0.0001),
          ),
        );
      const lightY = this.sunDirection.cross(lightX).normalize();
      const lightPosition = vec2(
        worldPosition.dot(lightX),
        worldPosition.dot(lightY),
      );
      const pageSize = level
        .equal(0)
        .select(
          float(SHADOW_PAGE_WORLD_SIZE),
          float(SHADOW_PAGE_WORLD_SIZE * 2),
        );
      const pageUv = lightPosition.div(pageSize).sub(pageId);
      varyingProperty("vec2", "deformedPageUv").assign(pageUv);
      const depth = this.maximumY
        .sub(worldPosition.y)
        .add(bucket.depthBiasMeters)
        .div(this.maximumY.sub(this.minimumY));
      varyingProperty("float", "deformedDepth").assign(depth);
      const atlasUv = this.computeAtlasUv(workItem.y, pageUv);
      return vec4(atlasUv.x.mul(2).sub(1), atlasUv.y.mul(-2).add(1), depth, 1);
    })();
    material.fragmentNode = Fn(() => {
      const pageUv = varyingProperty("vec2", "deformedPageUv");
      pageUv.x
        .lessThan(0)
        .or(pageUv.y.lessThan(0))
        .or(pageUv.x.greaterThan(1))
        .or(pageUv.y.greaterThan(1))
        .discard();
      if (entry.shadowOpacityNode && entry.alphaCutoff > 0)
        entry.shadowOpacityNode.lessThan(entry.alphaCutoff).discard();
      return vec4(varyingProperty("float", "deformedDepth"), 0, 0, 1);
    })();
    return material;
  }

  private createCasterMaterial(bucket: ShadowRigidCasterBucket) {
    const matrices = storage(
      bucket.matrixColumnsAttribute,
      "vec4",
      bucket.matrixColumnsAttribute.count,
    );
    const ranges = storage(
      bucket.pageRangesAttribute,
      "uvec4",
      bucket.pageRangesAttribute.count,
    );
    const depthBiases = storage(
      bucket.depthBiasAttribute,
      "float",
      bucket.depthBiasAttribute.count,
    );
    const material = new MeshBasicNodeMaterial();
    material.depthTest = true;
    material.depthWrite = true;
    material.side = DoubleSide;
    material.vertexNode = Fn(() => {
      const casterIndex = uint(attribute<"float">("casterIndex", "float"));
      const matrixOffset = casterIndex.mul(4);
      const worldPosition = matrices
        .element(matrixOffset)
        .mul(positionGeometry.x)
        .add(matrices.element(matrixOffset.add(1)).mul(positionGeometry.y))
        .add(matrices.element(matrixOffset.add(2)).mul(positionGeometry.z))
        .add(matrices.element(matrixOffset.add(3))).xyz;
      const job = this.pageJobsNode.element(
        instanceIndex.add(this.pageJobOffset),
      );
      const { level, pageId } = decodeGpuShadowPageKey(job.x);
      const page = uvec2(pageId.add(-SHADOW_PAGE_GRID_MIN));
      const range = ranges.element(casterIndex.mul(2).add(level));
      const overlaps = page.x
        .greaterThanEqual(range.x)
        .and(page.y.greaterThanEqual(range.y))
        .and(page.x.lessThanEqual(range.z))
        .and(page.y.lessThanEqual(range.w));
      const horizontalLength = this.sunDirection.xz.length();
      const lightX = horizontalLength
        .lessThan(0.0001)
        .select(
          vec3(1, 0, 0),
          vec3(this.sunDirection.z, 0, this.sunDirection.x.negate()).div(
            horizontalLength.max(0.0001),
          ),
        );
      const lightY = this.sunDirection.cross(lightX).normalize();
      const lightPosition = vec2(
        worldPosition.dot(lightX),
        worldPosition.dot(lightY),
      );
      const pageSize = level
        .equal(0)
        .select(
          float(SHADOW_PAGE_WORLD_SIZE),
          float(SHADOW_PAGE_WORLD_SIZE * 2),
        );
      const pageUv = lightPosition.div(pageSize).sub(pageId);
      varyingProperty("vec2", "fixedPageUv").assign(pageUv);
      const depth = this.maximumY
        .sub(worldPosition.y)
        .add(depthBiases.element(casterIndex))
        .div(this.maximumY.sub(this.minimumY));
      varyingProperty("float", "fixedDepth").assign(depth);
      const atlasUv = this.computeAtlasUv(job.y, pageUv);
      return overlaps.select(
        vec4(atlasUv.x.mul(2).sub(1), atlasUv.y.mul(-2).add(1), depth, 1),
        vec4(-2, -2, 1, 1),
      );
    })();
    material.fragmentNode = Fn(() => {
      const pageUv = varyingProperty("vec2", "fixedPageUv");
      pageUv.x
        .lessThan(0)
        .or(pageUv.y.lessThan(0))
        .or(pageUv.x.greaterThan(1))
        .or(pageUv.y.greaterThan(1))
        .discard();
      return vec4(varyingProperty("float", "fixedDepth"), 0, 0, 1);
    })();
    return material;
  }
}
