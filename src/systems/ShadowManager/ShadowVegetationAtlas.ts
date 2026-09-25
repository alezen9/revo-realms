import {
  BufferGeometry,
  DepthTexture,
  DoubleSide,
  FloatType,
  LessEqualCompare,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  RedFormat,
  Scene,
  UnsignedByteType,
  Vector2,
  Vector3,
} from "three";
import {
  IndirectStorageBufferAttribute,
  MeshBasicNodeMaterial,
  RenderTarget,
  StorageBufferAttribute,
  type ComputeNode,
  type Node,
  type WebGPURenderer,
} from "three/webgpu";
import {
  atomicAdd,
  atomicStore,
  float,
  Fn,
  If,
  instanceIndex,
  positionGeometry,
  storage,
  texture,
  uniform,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type {
  ShadowCasterEntry,
  ShadowCasterRegistry,
  ShadowDeformedInstances,
} from "./ShadowCasterRegistry";

const MAP_TEXELS = 2048;
const TILE_HALF_SIZE = 80;
const DEPTH_BIAS = 0.0015;

type VegetationDraw = {
  geometry: BufferGeometry;
  mesh: Mesh;
  indices: StorageBufferAttribute;
  indirect: IndirectStorageBufferAttribute;
  reset: ComputeNode;
  build: ComputeNode;
};

const getLightXAxis = (sunDirection: Node<"vec3">) => {
  const horizontalLength = sunDirection.xz.length();
  return horizontalLength
    .lessThan(0.0001)
    .select(
      vec3(1, 0, 0),
      vec3(sunDirection.z, 0, sunDirection.x.negate()).div(
        horizontalLength.max(0.0001),
      ),
    );
};

export class ShadowVegetationAtlas {
  private renderer: WebGPURenderer;
  private sunDirection: Node<"vec3">;
  private target: RenderTarget;
  private depthNode;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private draws: VegetationDraw[] = [];
  private registryVersion = -1;
  private lightMinimum = uniform(new Vector2());
  private lightSpan = uniform(1);
  private minimumY = uniform(-8);
  private maximumY = uniform(64);
  private isReady = uniform(0);
  private axisX = new Vector3();
  private axisY = new Vector3();
  private corner = new Vector3();

  constructor(renderer: WebGPURenderer, sunDirection: Node<"vec3">) {
    this.renderer = renderer;
    this.sunDirection = sunDirection;
    this.target = new RenderTarget(MAP_TEXELS, MAP_TEXELS, {
      depthBuffer: true,
      format: RedFormat,
      samples: 0,
      stencilBuffer: false,
      type: UnsignedByteType,
    });
    this.target.texture.name = "V2 vegetation depth debug";
    const depth = new DepthTexture(MAP_TEXELS, MAP_TEXELS, FloatType);
    depth.compareFunction = LessEqualCompare;
    depth.magFilter = LinearFilter;
    depth.minFilter = LinearFilter;
    depth.name = "V2 vegetation depth";
    this.target.depthTexture = depth;
    this.depthNode = texture(depth);
  }

  syncCasters(
    registry: ShadowCasterRegistry,
    terrainBounds: { min: number; max: number },
  ) {
    this.minimumY.value = Math.floor(terrainBounds.min - 8);
    this.maximumY.value = Math.ceil(terrainBounds.max + 64);
    if (this.registryVersion === registry.deformedVersion) return;
    this.registryVersion = registry.deformedVersion;
    for (const draw of this.draws) {
      this.scene.remove(draw.mesh);
      draw.geometry.dispose();
    }
    this.draws = [];
    for (const entry of registry.casters) {
      if (!entry.localVegetation || !entry.deformedInstances) continue;
      this.draws.push(this.createDraw(entry, entry.deformedInstances));
    }
  }

  render(
    playerPosition: Vector3,
    sunDirection: Vector3,
    terrainBounds: { min: number; max: number },
  ) {
    this.updateProjection(playerPosition, sunDirection, terrainBounds);
    for (const draw of this.draws) {
      this.renderer.compute(draw.reset);
      this.renderer.compute(draw.build);
    }
    const previousTarget = this.renderer.getRenderTarget();
    const wasAutoClearEnabled = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.setRenderTarget(this.target);
    try {
      this.renderer.clear(true, true, false);
      this.renderer.render(this.scene, this.camera);
      this.isReady.value = 1;
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      this.renderer.autoClear = wasAutoClearEnabled;
    }
  }

  sampleVisibility(worldPosition: Node<"vec3">, sceneDepth: Node<"float">) {
    const lightX = getLightXAxis(this.sunDirection);
    const lightY = this.sunDirection.cross(lightX).normalize();
    const lightPosition = vec2(
      worldPosition.dot(lightX),
      worldPosition.dot(lightY),
    );
    const uv = lightPosition.sub(this.lightMinimum).div(this.lightSpan);
    const receiverDepth = this.maximumY
      .sub(worldPosition.y)
      .div(this.maximumY.sub(this.minimumY));
    const isInside = uv.x
      .greaterThanEqual(0)
      .and(uv.y.greaterThanEqual(0))
      .and(uv.x.lessThan(1))
      .and(uv.y.lessThan(1))
      .and(sceneDepth.lessThan(1))
      .and(this.isReady.greaterThan(0));
    const visibility = this.depthNode
      .sample(uv.clamp(0.5 / MAP_TEXELS, 1 - 0.5 / MAP_TEXELS))
      .compare(receiverDepth.sub(DEPTH_BIAS));
    return isInside.select(visibility, float(1));
  }

  private createDraw(
    entry: ShadowCasterEntry,
    instances: ShadowDeformedInstances,
  ): VegetationDraw {
    const geometry = instances.geometry
      ? new BufferGeometry().copy(instances.geometry)
      : entry.mesh.geometry.clone();
    const position = geometry.getAttribute("position");
    if (!position) throw new Error("Vegetation shadow caster needs positions");
    const indices = new StorageBufferAttribute(
      new Uint32Array(instances.count),
      1,
    );
    const indirect = new IndirectStorageBufferAttribute(
      geometry.index
        ? new Uint32Array([geometry.index.count, 0, 0, 0, 0])
        : new Uint32Array([position.count, 0, 0, 0]),
      1,
    );
    geometry.setIndirect(indirect);
    const indexNode = storage(indices, "uint", instances.count);
    const indirectNode = storage(indirect, "uint", indirect.count).toAtomic();
    const reset = Fn(() => {
      atomicStore(indirectNode.element(1), 0);
    })().compute(1);
    const build = Fn(() => {
      If(instances.isActive(instanceIndex), () => {
        const outputIndex = atomicAdd(indirectNode.element(1), 1);
        indexNode.element(outputIndex).assign(instanceIndex);
      });
    })().compute(instances.count, [64]);
    const material = new MeshBasicNodeMaterial();
    material.depthTest = true;
    material.depthWrite = true;
    material.side = DoubleSide;
    material.vertexNode = Fn(() => {
      const casterIndex = indexNode.element(instanceIndex);
      const worldPosition = instances.worldPosition(
        casterIndex,
        positionGeometry,
      );
      const lightX = getLightXAxis(this.sunDirection);
      const lightY = this.sunDirection.cross(lightX).normalize();
      const lightPosition = vec2(
        worldPosition.dot(lightX),
        worldPosition.dot(lightY),
      );
      const uv = lightPosition.sub(this.lightMinimum).div(this.lightSpan);
      const depth = this.maximumY
        .sub(worldPosition.y)
        .add(entry.depthBiasMeters)
        .div(this.maximumY.sub(this.minimumY));
      varyingProperty("float", "vegetationDepth").assign(depth);
      return vec4(uv.x.mul(2).sub(1), uv.y.mul(-2).add(1), depth, 1);
    })();
    material.fragmentNode = Fn(() => {
      if (entry.shadowOpacityNode && entry.alphaCutoff > 0)
        entry.shadowOpacityNode.lessThan(entry.alphaCutoff).discard();
      return vec4(varyingProperty("float", "vegetationDepth"), 0, 0, 1);
    })();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return { geometry, mesh, indices, indirect, reset, build };
  }

  private updateProjection(
    player: Vector3,
    sun: Vector3,
    terrain: { min: number; max: number },
  ) {
    const horizontalLength = Math.hypot(sun.x, sun.z);
    if (horizontalLength < 0.0001) this.axisX.set(1, 0, 0);
    else this.axisX.set(sun.z / horizontalLength, 0, -sun.x / horizontalLength);
    this.axisY.crossVectors(sun, this.axisX).normalize();
    let minimumX = Infinity;
    let minimumY = Infinity;
    let maximumX = -Infinity;
    let maximumY = -Infinity;
    for (const x of [player.x - TILE_HALF_SIZE, player.x + TILE_HALF_SIZE]) {
      for (const z of [player.z - TILE_HALF_SIZE, player.z + TILE_HALF_SIZE]) {
        for (const y of [terrain.min - 8, terrain.max + 8]) {
          this.corner.set(x, y, z);
          const lightX = this.corner.dot(this.axisX);
          const lightY = this.corner.dot(this.axisY);
          minimumX = Math.min(minimumX, lightX);
          minimumY = Math.min(minimumY, lightY);
          maximumX = Math.max(maximumX, lightX);
          maximumY = Math.max(maximumY, lightY);
        }
      }
    }
    const texelSize =
      Math.max(maximumX - minimumX, maximumY - minimumY) / (MAP_TEXELS - 4);
    this.lightMinimum.value.set(
      Math.floor(minimumX / texelSize) * texelSize - texelSize * 2,
      Math.floor(minimumY / texelSize) * texelSize - texelSize * 2,
    );
    this.lightSpan.value = MAP_TEXELS * texelSize;
  }
}
