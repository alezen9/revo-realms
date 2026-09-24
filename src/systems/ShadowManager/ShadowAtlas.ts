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
  type Texture,
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
  float,
  Fn,
  If,
  instanceIndex,
  mix,
  positionGeometry,
  storage,
  texture,
  uint,
  uniform,
  uv,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  computeGpuShadowPageAddress,
  decodeGpuShadowPageKey,
  encodeGpuShadowPageKey,
  getGpuShadowPageWorldSize,
  SHADOW_MINIMUM_PAGE_COORDINATE,
  SHADOW_PAGE_GRID_SIZE,
  shadowPageCoordinateConfig,
  type ShadowPageCoordinates,
} from "./ShadowPageCoordinates";
import type { ShadowResidency } from "./ShadowResidency";
import { RigidShadowCasterBucket } from "./RigidShadowCasterBucket";
import type { PineShadowPages } from "./PineShadowPages";
import { PineShadowCasterBucket } from "./PineShadowCasterBucket";
import {
  getPineCanopyPosition,
  PINE_CANOPY_ALPHA_TEST,
} from "../../entities/Vegetation/PineTreeCanopy";

const PAGE_GRID_SIZE = SHADOW_PAGE_GRID_SIZE;
const MINIMUM_PAGE_COORDINATE = SHADOW_MINIMUM_PAGE_COORDINATE;
const SHADOW_DEPTH_BIAS = 0.0015;

type ConstructorArgs = {
  renderer: WebGPURenderer;
  residency: ShadowResidency;
  coordinates: ShadowPageCoordinates;
  sunDirection: Node<"vec3">;
  pageTexelSize?: number;
  name?: string;
};

export class ShadowAtlas {
  private renderer: WebGPURenderer;
  private residency: ShadowResidency;
  private coordinates: ShadowPageCoordinates;
  private sunDirection: Node<"vec3">;
  private pageTexelSize: number;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private atlasGridSize: number;
  private atlasSize: number;
  private renderTarget: RenderTarget;
  private pageJobsNode;
  private depthTextureNode;
  private casterWorldMatrix = uniform(new Matrix4());
  private isReady = uniform(0);
  private casterSource?: Mesh;
  private casterMesh?: Mesh;
  private rigidCasterBucket?: RigidShadowCasterBucket;
  private pineCasterBucket?: PineShadowCasterBucket;
  private isRenderTargetInitialized = false;

  constructor(args: ConstructorArgs) {
    const {
      renderer,
      residency,
      coordinates,
      sunDirection,
      pageTexelSize = 512,
      name = "Paged shadow atlas",
    } = args;
    this.renderer = renderer;
    this.residency = residency;
    this.coordinates = coordinates;
    this.sunDirection = sunDirection;
    this.pageTexelSize = pageTexelSize;
    this.atlasGridSize = Math.ceil(Math.sqrt(residency.capacity));
    this.atlasSize = this.atlasGridSize * this.pageTexelSize;
    this.renderTarget = new RenderTarget(this.atlasSize, this.atlasSize, {
      depthBuffer: true,
      format: RedFormat,
      samples: 0,
      stencilBuffer: false,
      type: UnsignedByteType,
    });
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
    depthTexture.name = `${name} depth`;
    this.renderTarget.depthTexture = depthTexture;
    this.renderTarget.texture.name = `${name} color`;
    this.depthTextureNode = texture(depthTexture);

    this.scene.add(this.createClearMesh());
  }

  attachCaster(source: Mesh) {
    if (this.casterMesh) return;

    const geometry = source.geometry.index
      ? source.geometry.toNonIndexed()
      : source.geometry.clone();
    this.setCasterGeometry(geometry);
    this.casterSource = source;
  }

  updateStaticCasters(sources: Mesh[], sunDirection: Vector3) {
    if (!this.rigidCasterBucket) {
      this.rigidCasterBucket = new RigidShadowCasterBucket(
        this.renderer,
        this.residency,
        sources,
      );
      this.casterMesh = new Mesh(
        this.rigidCasterBucket.geometry,
        this.createRigidCasterMaterial(this.rigidCasterBucket),
      );
      this.casterMesh.frustumCulled = false;
      this.casterMesh.renderOrder = 1;
      this.scene.add(this.casterMesh);
    }
    this.rigidCasterBucket.update(sources, this.coordinates, sunDirection);
  }

  attachPineCanopy(
    source: BatchedMesh,
    pages: PineShadowPages,
    opacityTexture: Texture,
  ) {
    if (this.pineCasterBucket) return;

    this.pineCasterBucket = new PineShadowCasterBucket(
      this.renderer,
      this.residency,
      pages,
      source,
    );
    this.casterMesh = new Mesh(
      this.pineCasterBucket.geometry,
      this.createPineCasterMaterial(this.pineCasterBucket, opacityTexture),
    );
    this.casterMesh.frustumCulled = false;
    this.casterMesh.renderOrder = 1;
    this.scene.add(this.casterMesh);
  }

  render() {
    if (!this.casterMesh) return;

    if (this.casterSource) {
      this.casterSource.updateWorldMatrix(true, false);
      this.casterWorldMatrix.value.copy(this.casterSource.matrixWorld);
    }
    this.rigidCasterBucket?.run();
    this.pineCasterBucket?.run();

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

  computeVisibility(
    worldPosition: Node<"vec3">,
    sceneDepth: Node<"float">,
    viewDepth: Node<"float">,
  ) {
    return Fn(() => {
      const visibility = float(1).toVar();
      const nearVisibility = float(1).toVar();
      const hasNearPage = uint(0).toVar();
      If(viewDepth.lessThan(shadowPageCoordinateConfig.transitionEnd), () => {
        const nearPage = this.lookupPage(worldPosition, sceneDepth, 0);
        If(nearPage.isValid, () => {
          nearVisibility.assign(nearPage.visibility);
          visibility.assign(nearPage.visibility);
          hasNearPage.assign(1);
        });
      });
      If(
        viewDepth.greaterThanEqual(shadowPageCoordinateConfig.transitionStart),
        () => {
          const farPage = this.lookupPage(worldPosition, sceneDepth, 1);
          If(farPage.isValid, () => {
            const blend = viewDepth
              .sub(shadowPageCoordinateConfig.transitionStart)
              .div(
                shadowPageCoordinateConfig.transitionEnd -
                  shadowPageCoordinateConfig.transitionStart,
              )
              .clamp(0, 1);
            visibility.assign(
              hasNearPage
                .greaterThan(0)
                .select(
                  mix(nearVisibility, farPage.visibility, blend),
                  farPage.visibility,
                ),
            );
          });
        },
      );
      return visibility;
    })();
  }

  private lookupPage(
    worldPosition: Node<"vec3">,
    sceneDepth: Node<"float">,
    level: number,
  ) {
    const address = computeGpuShadowPageAddress({
      worldPosition,
      sunDirection: this.sunDirection,
      minimumWorldY: this.coordinates.minimumWorldY,
      maximumWorldY: this.coordinates.maximumWorldY,
      level: uint(level),
    });
    const negativeTap = this.samplePage(
      address,
      sceneDepth,
      level,
      vec2(-0.5),
    );
    const positiveTap = this.samplePage(
      address,
      sceneDepth,
      level,
      vec2(0.5),
    );

    return {
      isValid: negativeTap.isValid.and(positiveTap.isValid),
      visibility: negativeTap.visibility.add(positiveTap.visibility).mul(0.5),
    };
  }

  private samplePage(
    address: ReturnType<typeof computeGpuShadowPageAddress>,
    sceneDepth: Node<"float">,
    level: number,
    texelOffset: Node<"vec2">,
  ) {
    const pagePosition = address.pageId
      .add(address.pageUv)
      .add(texelOffset.div(this.pageTexelSize));
    const pageId = pagePosition.floor();
    const localPage = pageId.sub(MINIMUM_PAGE_COORDINATE);
    const isInsideVirtualGrid = localPage.x
      .greaterThanEqual(0)
      .and(localPage.y.greaterThanEqual(0))
      .and(localPage.x.lessThan(PAGE_GRID_SIZE))
      .and(localPage.y.lessThan(PAGE_GRID_SIZE));
    const safeLocalPage = localPage.clamp(0, PAGE_GRID_SIZE - 1);
    const pageKey = encodeGpuShadowPageKey(
      uint(level),
      safeLocalPage.add(MINIMUM_PAGE_COORDINATE),
    );
    const mapping = this.residency.resolvePage(pageKey);
    const halfPageTexel = 0.5 / this.pageTexelSize;
    const pageUv = pagePosition
      .fract()
      .clamp(halfPageTexel, 1 - halfPageTexel);
    const atlasUv = this.computeAtlasUv(mapping.slot, pageUv);
    const visibility = this.depthTextureNode
      .sample(atlasUv)
      .compare(address.normalizedDepth.sub(SHADOW_DEPTH_BIAS));
    const isValid = this.isReady
      .greaterThan(0)
      .and(sceneDepth.lessThan(1))
      .and(address.isOutOfRange.not())
      .and(isInsideVirtualGrid)
      .and(mapping.isResident);

    return { isValid, visibility };
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

  private setCasterGeometry(geometry: BufferGeometry) {
    const position = geometry.getAttribute("position");
    if (!position) throw new Error("Shadow caster requires positions");

    this.residency.setCasterVertexCount(position.count);
    geometry.setIndirect(this.residency.casterIndirectAttribute);

    if (this.casterMesh) {
      this.casterMesh.geometry.dispose();
      this.casterMesh.geometry = geometry;
      return;
    }

    this.casterMesh = new Mesh(geometry, this.createCasterMaterial());
    this.casterMesh.frustumCulled = false;
    this.casterMesh.renderOrder = 1;
    this.scene.add(this.casterMesh);
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
      const { level, pageId } = decodeGpuShadowPageKey(pageKey);
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
        .div(getGpuShadowPageWorldSize(level))
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

  private createRigidCasterMaterial(bucket: RigidShadowCasterBucket) {
    const pageJobsNode = storage(
      bucket.pageJobsAttribute,
      "uvec2",
      bucket.pageJobsAttribute.count,
    );
    const matrixColumnsNode = storage(
      bucket.matrixColumnsAttribute,
      "vec4",
      bucket.matrixColumnsAttribute.count,
    );
    const material = new MeshBasicNodeMaterial();
    material.colorWrite = false;
    material.depthTest = true;
    material.depthWrite = true;
    material.side = DoubleSide;
    material.vertexNode = Fn(() => {
      const casterIndex = instanceIndex.div(this.residency.capacity);
      const matrixOffset = casterIndex.mul(4);
      const matrixColumn0 = matrixColumnsNode.element(matrixOffset);
      const matrixColumn1 = matrixColumnsNode.element(matrixOffset.add(1));
      const matrixColumn2 = matrixColumnsNode.element(matrixOffset.add(2));
      const matrixColumn3 = matrixColumnsNode.element(matrixOffset.add(3));
      const worldPosition = matrixColumn0
        .mul(positionGeometry.x)
        .add(matrixColumn1.mul(positionGeometry.y))
        .add(matrixColumn2.mul(positionGeometry.z))
        .add(matrixColumn3).xyz;
      const pageJob = pageJobsNode.element(instanceIndex);
      const pageKey = pageJob.x;
      const slot = pageJob.y;
      const { level, pageId } = decodeGpuShadowPageKey(pageKey);
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
        .div(getGpuShadowPageWorldSize(level))
        .sub(pageId);
      varyingProperty("vec2", "rigidShadowAtlasPageUv").assign(pageUv);

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
      const pageUv = varyingProperty("vec2", "rigidShadowAtlasPageUv");
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

  private createPineCasterMaterial(
    bucket: PineShadowCasterBucket,
    opacityTexture: Texture,
  ) {
    const workItemsNode = storage(
      bucket.workItemsAttribute,
      "uvec4",
      bucket.workItemsAttribute.count,
    );
    const matrixColumnsNode = storage(
      bucket.matrixColumnsAttribute,
      "vec4",
      bucket.matrixColumnsAttribute.count,
    );
    const opacityTextureNode = texture(opacityTexture, uv());
    const material = new MeshBasicNodeMaterial();
    material.colorWrite = false;
    material.depthTest = true;
    material.depthWrite = true;
    material.side = DoubleSide;
    material.vertexNode = Fn(() => {
      const workItem = workItemsNode.element(instanceIndex);
      const pageKey = workItem.x;
      const slot = workItem.y;
      const matrixOffset = workItem.z.mul(4);
      const matrixColumn0 = matrixColumnsNode.element(matrixOffset);
      const matrixColumn1 = matrixColumnsNode.element(matrixOffset.add(1));
      const matrixColumn2 = matrixColumnsNode.element(matrixOffset.add(2));
      const matrixColumn3 = matrixColumnsNode.element(matrixOffset.add(3));
      const localPosition = getPineCanopyPosition();
      const worldPosition = matrixColumn0
        .mul(localPosition.x)
        .add(matrixColumn1.mul(localPosition.y))
        .add(matrixColumn2.mul(localPosition.z))
        .add(matrixColumn3).xyz;
      const { level, pageId } = decodeGpuShadowPageKey(pageKey);
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
        .div(getGpuShadowPageWorldSize(level))
        .sub(pageId);
      varyingProperty("vec2", "pineShadowAtlasPageUv").assign(pageUv);

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
      const pageUv = varyingProperty("vec2", "pineShadowAtlasPageUv");
      pageUv.x
        .lessThan(0)
        .or(pageUv.y.lessThan(0))
        .or(pageUv.x.greaterThan(1))
        .or(pageUv.y.greaterThan(1))
        .discard();
      opacityTextureNode.a.lessThan(PINE_CANOPY_ALPHA_TEST).discard();
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
