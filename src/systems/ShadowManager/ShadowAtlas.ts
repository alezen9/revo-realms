import {
  BufferGeometry,
  DepthTexture,
  DoubleSide,
  Float32BufferAttribute,
  FloatType,
  LessEqualCompare,
  LinearFilter,
  Matrix4,
  Mesh,
  OrthographicCamera,
  RedFormat,
  Scene,
  UnsignedByteType,
} from "three";
import {
  MeshBasicNodeMaterial,
  RenderTarget,
  type Node,
  type WebGPURenderer,
} from "three/webgpu";
import {
  float,
  Fn,
  instanceIndex,
  positionGeometry,
  storage,
  texture,
  uint,
  uniform,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { shadowConfig } from "./config";
import {
  computeGpuShadowPageAddress,
  shadowPageCoordinateConfig,
  type ShadowPageCoordinates,
} from "./ShadowPageCoordinates";
import type { ShadowResidency } from "./ShadowResidency";

const PAGE_GRID_SIZE = 128;
const MINIMUM_PAGE_COORDINATE = -PAGE_GRID_SIZE / 2;
const PAGE_TEXEL_SIZE = 512;
const SHADOW_DEPTH_BIAS = 0.0015;

type ConstructorArgs = {
  renderer: WebGPURenderer;
  residency: ShadowResidency;
  coordinates: ShadowPageCoordinates;
  sunDirection: Node<"vec3">;
};

export class ShadowAtlas {
  private renderer: WebGPURenderer;
  private residency: ShadowResidency;
  private coordinates: ShadowPageCoordinates;
  private sunDirection: Node<"vec3">;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private atlasGridSize = Math.ceil(Math.sqrt(shadowConfig.poolCapacity));
  private atlasSize = this.atlasGridSize * PAGE_TEXEL_SIZE;
  private renderTarget = new RenderTarget(this.atlasSize, this.atlasSize, {
    depthBuffer: true,
    format: RedFormat,
    samples: 0,
    stencilBuffer: false,
    type: UnsignedByteType,
  });
  private pageJobsNode;
  private depthTextureNode;
  private casterWorldMatrix = uniform(new Matrix4());
  private isReady = uniform(0);
  private casterSource?: Mesh;
  private isRenderTargetInitialized = false;

  constructor(args: ConstructorArgs) {
    const { renderer, residency, coordinates, sunDirection } = args;
    this.renderer = renderer;
    this.residency = residency;
    this.coordinates = coordinates;
    this.sunDirection = sunDirection;
    this.pageJobsNode = storage(
      residency.pageJobsAttribute,
      "uvec2",
      residency.pageJobsAttribute.count,
    );

    const depthTexture = new DepthTexture(
      this.atlasSize,
      this.atlasSize,
      FloatType,
    );
    depthTexture.compareFunction = LessEqualCompare;
    depthTexture.magFilter = LinearFilter;
    depthTexture.minFilter = LinearFilter;
    depthTexture.name = "Paged shadow atlas depth";
    this.renderTarget.depthTexture = depthTexture;
    this.renderTarget.texture.name = "Paged shadow atlas color";
    this.depthTextureNode = texture(depthTexture);

    this.scene.add(this.createClearMesh());
  }

  attachCaster(source: Mesh) {
    if (this.casterSource) return;

    const geometry = source.geometry.index
      ? source.geometry.toNonIndexed()
      : source.geometry.clone();
    const position = geometry.getAttribute("position");
    if (!position) throw new Error("Shadow caster requires positions");

    this.residency.setCasterVertexCount(position.count);
    geometry.setIndirect(this.residency.casterIndirectAttribute);

    const caster = new Mesh(geometry, this.createCasterMaterial());
    caster.frustumCulled = false;
    caster.renderOrder = 1;
    this.scene.add(caster);
    this.casterSource = source;
  }

  render() {
    if (!this.casterSource) return;

    this.casterSource.updateWorldMatrix(true, false);
    this.casterWorldMatrix.value.copy(this.casterSource.matrixWorld);

    const previousRenderTarget = this.renderer.getRenderTarget();
    const wasAutoClearEnabled = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.setRenderTarget(this.renderTarget);
    try {
      if (!this.isRenderTargetInitialized) {
        this.renderer.clear(true, true, false);
        this.isRenderTargetInitialized = true;
      }
      this.renderer.render(this.scene, this.camera);
      this.isReady.value = 1;
    } finally {
      this.renderer.setRenderTarget(previousRenderTarget);
      this.renderer.autoClear = wasAutoClearEnabled;
    }
  }

  computeVisibility(worldPosition: Node<"vec3">, sceneDepth: Node<"float">) {
    const address = computeGpuShadowPageAddress({
      worldPosition,
      sunDirection: this.sunDirection,
      minimumWorldY: this.coordinates.minimumWorldY,
      maximumWorldY: this.coordinates.maximumWorldY,
    });
    const localPage = address.pageId.sub(MINIMUM_PAGE_COORDINATE);
    const isInsideVirtualGrid = localPage.x
      .greaterThanEqual(0)
      .and(localPage.y.greaterThanEqual(0))
      .and(localPage.x.lessThan(PAGE_GRID_SIZE))
      .and(localPage.y.lessThan(PAGE_GRID_SIZE));
    const safeLocalPage = localPage.clamp(0, PAGE_GRID_SIZE - 1);
    const pageKey = uint(safeLocalPage.y)
      .mul(PAGE_GRID_SIZE)
      .add(uint(safeLocalPage.x));
    const mapping = this.residency.resolvePage(pageKey);
    const halfPageTexel = 0.5 / PAGE_TEXEL_SIZE;
    const pageUv = address.pageUv.clamp(
      halfPageTexel,
      1 - halfPageTexel,
    );
    const atlasUv = this.computeAtlasUv(mapping.slot, pageUv);
    const visibility = this.depthTextureNode
      .sample(atlasUv)
      .compare(address.normalizedDepth.sub(SHADOW_DEPTH_BIAS));
    const hasValidShadow = this.isReady
      .greaterThan(0)
      .and(sceneDepth.lessThan(1))
      .and(address.isOutOfRange.not())
      .and(isInsideVirtualGrid)
      .and(mapping.isResident);

    return hasValidShadow.select(visibility, float(1));
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
    material.colorWrite = false;
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

    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 0;
    return mesh;
  }

  private createCasterMaterial() {
    const material = new MeshBasicNodeMaterial();
    material.colorWrite = false;
    material.depthTest = true;
    material.depthWrite = true;
    material.side = DoubleSide;
    material.vertexNode = Fn(() => {
      const pageJob = this.pageJobsNode.element(instanceIndex);
      const pageKey = pageJob.x;
      const slot = pageJob.y;
      const pageId = vec2(
        float(pageKey.mod(PAGE_GRID_SIZE)),
        float(pageKey.div(PAGE_GRID_SIZE)),
      ).add(MINIMUM_PAGE_COORDINATE);
      const worldPosition = this.casterWorldMatrix.mul(
        vec4(positionGeometry, 1),
      ).xyz;
      const absoluteSunY = this.sunDirection.y.abs().max(0.0001);
      const horizontalSunLength = this.sunDirection.xz.length().max(0.0001);
      const lightXAxis = vec3(
        this.sunDirection.z,
        0,
        this.sunDirection.x.negate(),
      ).div(horizontalSunLength);
      const lightYAxis = this.sunDirection.cross(lightXAxis).normalize();
      const lightPosition = vec2(
        worldPosition.dot(lightXAxis),
        worldPosition.dot(lightYAxis),
      );
      const pageUv = lightPosition
        .div(shadowPageCoordinateConfig.pageWorldSize)
        .sub(pageId);
      varyingProperty("vec2", "shadowAtlasPageUv").assign(pageUv);

      const relativeDepth = worldPosition.y.negate().div(absoluteSunY);
      const minimumDepth = this.coordinates.maximumWorldY
        .negate()
        .div(absoluteSunY);
      const maximumDepth = this.coordinates.minimumWorldY
        .negate()
        .div(absoluteSunY);
      const normalizedDepth = relativeDepth
        .sub(minimumDepth)
        .div(maximumDepth.sub(minimumDepth));
      const atlasUv = this.computeAtlasUv(slot, pageUv);

      return vec4(
        atlasUv.x.mul(2).sub(1),
        atlasUv.y.mul(-2).add(1),
        normalizedDepth,
        1,
      );
    })();
    material.fragmentNode = Fn(() => {
      const pageUv = varyingProperty("vec2", "shadowAtlasPageUv");
      pageUv.x
        .lessThan(0)
        .or(pageUv.y.lessThan(0))
        .or(pageUv.x.greaterThan(1))
        .or(pageUv.y.greaterThan(1))
        .discard();
      return vec4(0);
    })();
    return material;
  }

  private computeAtlasUv(slot, pageUv) {
    const tile = vec2(
      float(slot.mod(this.atlasGridSize)),
      float(slot.div(this.atlasGridSize)),
    );
    return tile.add(pageUv).div(this.atlasGridSize);
  }
}
