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
  StorageBufferAttribute,
  type ComputeNode,
  RenderTarget,
  type Node,
  type WebGPURenderer,
} from "three/webgpu";
import {
  atomicAdd,
  atomicLoad,
  attribute,
  bool,
  float,
  Fn,
  If,
  instanceIndex,
  Loop,
  positionGeometry,
  storage,
  texture,
  uniform,
  uint,
  uvec2,
  varyingProperty,
  vertexIndex,
  vec2,
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
  SHADOW_LEVEL_COUNT,
  SHADOW_PAGE_OFFSET,
  SHADOW_PAGE_TEXELS,
  SHADOW_PAGES_PER_LEVEL,
  getShadowDynamicLevel,
  getShadowLevel,
  getShadowLightPosition,
  getShadowPageCoordinate,
  getShadowPageKey,
  getShadowPageSize,
  getShadowPageTag,
  shadowDynamicLevel,
} from "./ShadowPageCoordinates";
import type { ShadowResidency } from "./ShadowResidency";

const DEPTH_BIAS_TEXELS = { fixed: 3, moving: 8 };

export class ShadowRigidAtlas {
  readonly depthBiasTexels;
  private renderer: WebGPURenderer;
  private residency: ShadowResidency;
  private sunDirection: Node<"vec3">;
  private softness: Node<"float">;
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
    bucket: ShadowDeformedCasterBucket;
    mesh: Mesh;
  }[] = [];
  private dynamicJobsNode?: ComputeNode;
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
    softness: Node<"float">,
    kind: "fixed" | "moving",
  ) {
    this.renderer = renderer;
    this.residency = residency;
    this.sunDirection = sunDirection;
    this.softness = softness;
    this.kind = kind;
    this.depthBiasTexels = uniform(DEPTH_BIAS_TEXELS[kind]);
    this.pageJobOffset = kind === "fixed" ? 0 : residency.capacity * 2;
    this.atlasGridSize = Math.ceil(Math.sqrt(residency.capacity));
    const atlasSize = this.atlasGridSize * SHADOW_PAGE_TEXELS;
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
      "uvec4",
      residency.capacity * 3,
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
        if (!entry.castsShadow) continue;
        if (this.kind === "moving" && entry.deformedInstances) {
          const bucket = new ShadowDeformedCasterBucket(
            this.renderer,
            this.residency,
            entry.mesh,
            entry.deformedInstances,
            this.sunDirection,
          );
          const mesh = new Mesh(
            bucket.geometry,
            this.createDeformedCasterMaterial(bucket, entry),
          );
          mesh.frustumCulled = false;
          mesh.renderOrder = 3;
          this.scene.add(mesh);
          this.deformedCasters.push({ bucket, mesh });
        }
        if (entry.kind !== this.kind || entry.deformedInstances) continue;
        if (!(entry.mesh instanceof BatchedMesh)) {
          this.sources.push(entry);
          continue;
        }
        if (this.kind === "fixed") {
          const bucket = new ShadowPineCasterBucket(
            this.renderer,
            this.residency,
            entry.mesh,
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
      if (this.kind === "moving")
        this.dynamicJobsNode = this.createDynamicJobsNode(this.bucket);
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
    for (const { bucket } of this.deformedCasters) bucket.run();
    if (this.dynamicJobsNode) this.renderer.compute(this.dynamicJobsNode);
    for (const { bucket } of this.batchedCasters) bucket.run();
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
    viewDistance: Node<"float">,
    secondary?: ShadowRigidAtlas,
  ) {
    const receiverLevel = getShadowLevel(viewDistance);
    const level =
      this.kind === "fixed"
        ? receiverLevel
        : getShadowDynamicLevel(receiverLevel);
    const lightPosition = getShadowLightPosition(
      worldPosition,
      this.sunDirection,
    );
    const taps = [
      vec2(this.softness.negate(), this.softness.negate()),
      vec2(this.softness, this.softness.negate()),
      vec2(this.softness.negate(), this.softness),
      vec2(this.softness, this.softness),
    ].map((texelOffset) =>
      this.sampleTap(
        lightPosition,
        worldPosition,
        sceneDepth,
        level,
        texelOffset,
      ),
    );
    let weight: Node<"float"> = float(0);
    let visibility: Node<"float"> = float(0);
    for (const tap of taps) {
      const tapWeight = tap.isValid.select(float(1), float(0));
      weight = weight.add(tapWeight);
      visibility = visibility.add(tap.visibility.mul(tapWeight));
    }
    const ownVisibility = weight
      .greaterThan(0)
      .select(visibility.div(weight.max(1)), float(1));
    if (!secondary) return ownVisibility;
    return ownVisibility.mul(
      secondary.computeVisibility(worldPosition, sceneDepth, viewDistance),
    );
  }

  private sampleTap(
    lightPosition: Node<"vec2">,
    worldPosition: Node<"vec3">,
    sceneDepth: Node<"float">,
    level: Node<"uint">,
    texelOffset: Node<"vec2">,
  ) {
    const pageSize = getShadowPageSize(level);
    const pagePosition = lightPosition
      .div(pageSize)
      .add(texelOffset.div(SHADOW_PAGE_TEXELS));
    const pageCoordinate = getShadowPageCoordinate(pagePosition);
    const { slot, isResident, hasDynamic } = this.residency.resolvePage(
      getShadowPageKey(level, pageCoordinate),
      getShadowPageTag(pageCoordinate),
    );
    const halfTexel = 0.5 / SHADOW_PAGE_TEXELS;
    const pageUv = pagePosition.fract().clamp(halfTexel, 1 - halfTexel);
    const receiverDepth = this.maximumY
      .sub(worldPosition.y)
      .sub(pageSize.mul(this.depthBiasTexels).div(SHADOW_PAGE_TEXELS))
      .div(this.maximumY.sub(this.minimumY));
    const visibility = this.depthTextureNode
      .sample(this.computeAtlasUv(slot, pageUv))
      .compare(receiverDepth);
    const isValid = this.isReady
      .greaterThan(0)
      .and(sceneDepth.lessThan(1))
      .and(worldPosition.y.greaterThanEqual(this.minimumY))
      .and(worldPosition.y.lessThanEqual(this.maximumY))
      .and(this.sunDirection.y.lessThan(-0.25))
      .and(this.kind === "fixed" ? isResident : hasDynamic);
    return { isValid, visibility };
  }

  private createDynamicJobsNode(bucket?: ShadowRigidCasterBucket) {
    const capacity = this.residency.capacity;
    const rangesAttribute =
      bucket?.pageRangesAttribute ??
      new StorageBufferAttribute(new Uint32Array(4), 4);
    const ranges = storage(rangesAttribute, "uvec4", rangesAttribute.count);
    const counters = storage(
      this.residency.counterAttribute,
      "uint",
      this.residency.counterAttribute.count,
    ).toAtomic();
    const indirect = storage(
      this.residency.atlasIndirectAttribute,
      "uint",
      16,
    ).toAtomic();
    return Fn(() => {
      const activeCount = atomicLoad(
        counters.element(this.residency.activeCountIndex),
      );
      If(instanceIndex.lessThan(activeCount), () => {
        const job = this.pageJobsNode.element(instanceIndex.add(capacity));
        const level = job.x.div(SHADOW_PAGES_PER_LEVEL);
        const isTouched = this.residency.pageTableNode
          .element(job.x)
          .y.equal(this.residency.frame)
          .select(uint(1), uint(0))
          .toVar();
        Loop(
          { start: 0, end: bucket?.casterCount ?? 0, type: "uint" },
          ({ i: casterIndex }) => {
            const range = ranges.element(
              casterIndex.mul(SHADOW_LEVEL_COUNT).add(level),
            );
            const overlaps = job.z
              .greaterThanEqual(range.x)
              .and(job.w.greaterThanEqual(range.y))
              .and(job.z.lessThanEqual(range.z))
              .and(job.w.lessThanEqual(range.w));
            isTouched.assign(overlaps.select(uint(1), isTouched));
          },
        );
        If(
          isTouched
            .greaterThan(0)
            .and(level.greaterThanEqual(shadowDynamicLevel)),
          () => {
            const dynamicIndex = atomicAdd(indirect.element(9), 1);
            atomicAdd(indirect.element(13), 1);
            this.pageJobsNode
              .element(dynamicIndex.add(capacity * 2))
              .assign(job);
            this.residency.pageTableNode
              .element(job.x)
              .assign(uvec2(job.y.add(1), this.residency.frame));
          },
        );
      });
    })().compute(capacity, [64]);
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
    geometry.setIndirect(this.residency.atlasIndirectAttribute, [
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

  private getJobPageUv(job: Node<"uvec4">, worldPosition: Node<"vec3">) {
    return this.getPageUv(
      job.x.div(SHADOW_PAGES_PER_LEVEL),
      vec2(job.z, job.w),
      worldPosition,
    );
  }

  private getPageUv(
    level: Node<"uint">,
    pageCoordinate: Node<"vec2">,
    worldPosition: Node<"vec3">,
  ) {
    return getShadowLightPosition(worldPosition, this.sunDirection)
      .div(getShadowPageSize(level))
      .sub(pageCoordinate.sub(SHADOW_PAGE_OFFSET));
  }

  private createDeformedCasterMaterial(
    bucket: ShadowDeformedCasterBucket,
    entry: ShadowCasterEntry,
  ) {
    const material = new MeshBasicNodeMaterial();
    material.depthTest = true;
    material.depthWrite = true;
    material.side = DoubleSide;
    const pageUv = varyingProperty("vec2", "deformedPageUv");
    const depth = varyingProperty("float", "deformedDepth");
    material.vertexNode = Fn(() => {
      const { slot, level, instance, pageCoordinate } =
        bucket.getWorkItem(instanceIndex);
      const corners = this.getTriangleCorners(bucket, instance);
      const cornerIndex = vertexIndex.mod(3);
      const worldPosition = corners
        ? cornerIndex
            .equal(0)
            .select(
              corners[0],
              cornerIndex.equal(1).select(corners[1], corners[2]),
            )
        : bucket.instances.worldPositions(instance, [positionGeometry])[0];
      const casterPageUv = this.getPageUv(level, pageCoordinate, worldPosition);
      const casterDepth = this.maximumY
        .sub(worldPosition.y)
        .add(entry.depthBiasMeters)
        .div(this.maximumY.sub(this.minimumY));
      pageUv.assign(casterPageUv);
      depth.assign(casterDepth);
      const overlapsPage = corners
        ? this.isTriangleInPage(corners, level, pageCoordinate)
        : bool(true);
      const atlasUv = this.computeAtlasUv(slot, casterPageUv);
      return overlapsPage.select(
        vec4(atlasUv.x.mul(2).sub(1), atlasUv.y.mul(-2).add(1), casterDepth, 1),
        vec4(-2, -2, 1, 1),
      );
    })();
    material.fragmentNode = this.createCasterFragment(pageUv, depth, entry);
    return material;
  }

  private getTriangleCorners(
    bucket: ShadowDeformedCasterBucket,
    instance: Node<"uint">,
  ) {
    if (!bucket.cornersAttribute) return undefined;
    const corners = storage(
      bucket.cornersAttribute,
      "vec4",
      bucket.cornersAttribute.count,
    );
    const firstCorner = vertexIndex.sub(vertexIndex.mod(3));
    return bucket.instances
      .worldPositions(
        instance,
        [0, 1, 2].map((corner) => corners.element(firstCorner.add(corner)).xyz),
      )
      .map((corner) => corner.toVar());
  }

  private isTriangleInPage(
    corners: Node<"vec3">[],
    level: Node<"uint">,
    pageCoordinate: Node<"vec2">,
  ) {
    const cornerUvs = corners.map((corner) =>
      this.getPageUv(level, pageCoordinate, corner),
    );
    const minimum = cornerUvs[0].min(cornerUvs[1]).min(cornerUvs[2]);
    const maximum = cornerUvs[0].max(cornerUvs[1]).max(cornerUvs[2]);
    return minimum.x
      .lessThan(1)
      .and(minimum.y.lessThan(1))
      .and(maximum.x.greaterThan(0))
      .and(maximum.y.greaterThan(0));
  }

  private createCasterFragment(
    pageUv: Node<"vec2">,
    depth: Node<"float">,
    entry?: ShadowCasterEntry,
  ) {
    return Fn(() => {
      pageUv.x
        .lessThan(0)
        .or(pageUv.y.lessThan(0))
        .or(pageUv.x.greaterThan(1))
        .or(pageUv.y.greaterThan(1))
        .discard();
      if (entry?.shadowOpacityNode && entry.alphaCutoff > 0)
        entry.shadowOpacityNode.lessThan(entry.alphaCutoff).discard();
      return vec4(depth, 0, 0, 1);
    })();
  }

  private createBatchedCasterMaterial(
    bucket: ShadowPineCasterBucket,
    entry: ShadowCasterEntry,
  ) {
    const workItems = storage(
      bucket.workItemsAttribute,
      "uvec2",
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
    const pageUv = varyingProperty("vec2", "batchedPageUv");
    const depth = varyingProperty("float", "batchedDepth");
    material.vertexNode = Fn(() => {
      const workItem = workItems.element(instanceIndex);
      const job = this.pageJobsNode.element(workItem.x);
      const matrixOffset = workItem.y.mul(4);
      const worldPosition = matrices
        .element(matrixOffset)
        .mul(positionGeometry.x)
        .add(matrices.element(matrixOffset.add(1)).mul(positionGeometry.y))
        .add(matrices.element(matrixOffset.add(2)).mul(positionGeometry.z))
        .add(matrices.element(matrixOffset.add(3))).xyz;
      const casterPageUv = this.getJobPageUv(job, worldPosition);
      const casterDepth = this.maximumY
        .sub(worldPosition.y)
        .add(bucket.depthBiasMeters)
        .div(this.maximumY.sub(this.minimumY));
      pageUv.assign(casterPageUv);
      depth.assign(casterDepth);
      const atlasUv = this.computeAtlasUv(job.y, casterPageUv);
      return vec4(
        atlasUv.x.mul(2).sub(1),
        atlasUv.y.mul(-2).add(1),
        casterDepth,
        1,
      );
    })();
    material.fragmentNode = this.createCasterFragment(pageUv, depth, entry);
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
    const pageUv = varyingProperty("vec2", "rigidPageUv");
    const depth = varyingProperty("float", "rigidDepth");
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
      const range = ranges.element(
        casterIndex
          .mul(SHADOW_LEVEL_COUNT)
          .add(job.x.div(SHADOW_PAGES_PER_LEVEL)),
      );
      const overlaps = job.z
        .greaterThanEqual(range.x)
        .and(job.w.greaterThanEqual(range.y))
        .and(job.z.lessThanEqual(range.z))
        .and(job.w.lessThanEqual(range.w));
      const casterPageUv = this.getJobPageUv(job, worldPosition);
      const casterDepth = this.maximumY
        .sub(worldPosition.y)
        .add(depthBiases.element(casterIndex))
        .div(this.maximumY.sub(this.minimumY));
      pageUv.assign(casterPageUv);
      depth.assign(casterDepth);
      const atlasUv = this.computeAtlasUv(job.y, casterPageUv);
      return overlaps.select(
        vec4(atlasUv.x.mul(2).sub(1), atlasUv.y.mul(-2).add(1), casterDepth, 1),
        vec4(-2, -2, 1, 1),
      );
    })();
    material.fragmentNode = this.createCasterFragment(pageUv, depth);
    return material;
  }
}
