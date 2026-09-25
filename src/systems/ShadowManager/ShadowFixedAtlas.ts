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
  instanceIndex,
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
import type { ShadowCasterRegistry } from "./ShadowCasterRegistry";
import { ShadowFixedCasterBucket } from "./ShadowFixedCasterBucket";
import {
  decodeGpuShadowPageKey,
  SHADOW_PAGE_GRID_MIN,
  SHADOW_PAGE_WORLD_SIZE,
} from "./ShadowPageCoordinates";
import type { ShadowResidency } from "./ShadowResidency";

export const SHADOW_FIXED_PAGE_TEXELS = 256;

export class ShadowFixedAtlas {
  private renderer: WebGPURenderer;
  private residency: ShadowResidency;
  private sunDirection: Node<"vec3">;
  private atlasGridSize: number;
  private renderTarget: RenderTarget;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private pageJobsNode;
  private minimumY = uniform(-8);
  private maximumY = uniform(64);
  private sources: Mesh[] = [];
  private bucket?: ShadowFixedCasterBucket;
  private casterMesh?: Mesh;
  private registryVersion = -1;
  private previousSunDirection = new Vector3();
  private bounds = new Box3();
  private isTargetInitialized = false;

  constructor(
    renderer: WebGPURenderer,
    residency: ShadowResidency,
    sunDirection: Node<"vec3">,
  ) {
    this.renderer = renderer;
    this.residency = residency;
    this.sunDirection = sunDirection;
    this.atlasGridSize = Math.ceil(Math.sqrt(residency.capacity));
    const atlasSize = this.atlasGridSize * SHADOW_FIXED_PAGE_TEXELS;
    this.renderTarget = new RenderTarget(atlasSize, atlasSize, {
      depthBuffer: true,
      format: RedFormat,
      samples: 0,
      stencilBuffer: false,
      type: UnsignedByteType,
    });
    this.renderTarget.texture.name = "V2 fixed depth debug";
    this.renderTarget.texture.magFilter = NearestFilter;
    this.renderTarget.texture.minFilter = NearestFilter;
    const depthTexture = new DepthTexture(atlasSize, atlasSize, FloatType);
    depthTexture.compareFunction = LessEqualCompare;
    depthTexture.magFilter = LinearFilter;
    depthTexture.minFilter = LinearFilter;
    depthTexture.name = "V2 fixed depth";
    this.renderTarget.depthTexture = depthTexture;
    this.pageJobsNode = storage(
      residency.pageJobsAttribute,
      "uvec2",
      residency.capacity,
    );
    this.scene.add(this.createClearMesh());
  }

  syncCasters(
    registry: ShadowCasterRegistry,
    sunDirection: Vector3,
    terrainBounds: { min: number; max: number },
  ) {
    const hasRosterChange = registry.fixedVersion !== this.registryVersion;
    const hasSunChange = !this.previousSunDirection.equals(sunDirection);
    if (!hasRosterChange && !hasSunChange) return;

    this.previousSunDirection.copy(sunDirection);
    if (hasRosterChange) {
      this.registryVersion = registry.fixedVersion;
      this.sources = [];
      for (const entry of registry.casters) {
        if (entry.kind === "fixed" && !(entry.mesh instanceof BatchedMesh))
          this.sources.push(entry.mesh);
      }
      if (this.casterMesh) this.scene.remove(this.casterMesh);
      this.bucket?.dispose();
      this.bucket = undefined;
      this.casterMesh = undefined;
      if (this.sources.length > 0) {
        this.bucket = new ShadowFixedCasterBucket(this.residency, this.sources);
        this.casterMesh = new Mesh(
          this.bucket.geometry,
          this.createCasterMaterial(this.bucket),
        );
        this.casterMesh.frustumCulled = false;
        this.casterMesh.renderOrder = 1;
        this.scene.add(this.casterMesh);
      } else {
        this.residency.setFixedVertexCount(0);
      }
    }

    let minimumY = terrainBounds.min - 8;
    let maximumY = terrainBounds.max + 64;
    for (const source of this.sources) {
      this.bounds.setFromObject(source, true);
      minimumY = Math.min(minimumY, this.bounds.min.y);
      maximumY = Math.max(maximumY, this.bounds.max.y);
    }
    this.minimumY.value = Math.floor(minimumY);
    this.maximumY.value = Math.ceil(maximumY);
    this.bucket?.update(this.sources, sunDirection);
    if (hasRosterChange) this.residency.invalidate();
  }

  render() {
    if (!this.bucket) return;
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
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      this.renderer.autoClear = wasAutoClearEnabled;
    }
  }

  sampleDebugDepth(slot: Node<"uint">, pageUv: Node<"vec2">) {
    const atlasUv = this.computeAtlasUv(slot, pageUv);
    return texture(this.renderTarget.texture).sample(atlasUv).r;
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
    geometry.setIndirect(this.residency.clearIndirectAttribute);
    const material = new MeshBasicNodeMaterial();
    material.depthTest = false;
    material.depthWrite = true;
    material.side = DoubleSide;
    material.depthNode = float(1);
    material.vertexNode = Fn(() => {
      const slot = this.pageJobsNode.element(instanceIndex).y;
      const pageUv = positionGeometry.xy.mul(0.5).add(0.5);
      const atlasUv = this.computeAtlasUv(slot, pageUv);
      return vec4(atlasUv.x.mul(2).sub(1), atlasUv.y.mul(-2).add(1), 1, 1);
    })();
    material.fragmentNode = vec4(1);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  private createCasterMaterial(bucket: ShadowFixedCasterBucket) {
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
      const job = this.pageJobsNode.element(instanceIndex);
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
