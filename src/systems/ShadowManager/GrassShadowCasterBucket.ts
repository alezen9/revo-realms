import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
} from "three";
import {
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
  step,
  storage,
  uint,
  uvec4,
  vec3,
} from "three/tsl";
import type { GrassCompute } from "../../entities/Vegetation/Grass/GrassCompute";
import { getYOffset } from "../../entities/Vegetation/Grass/GrassBladeData";
import {
  config as grassConfig,
  uniforms as grassUniforms,
} from "../../entities/Vegetation/Grass/config";
import {
  computeGpuShadowPageAddress,
  encodeGpuShadowPageKey,
  SHADOW_PAGE_LEVEL_COUNT,
} from "./ShadowPageCoordinates";
import type { ShadowResidency } from "./ShadowResidency";

const createGrassShadowGeometry = (source: Mesh) => {
  const sourceGeometry = source.geometry.index
    ? source.geometry.toNonIndexed()
    : source.geometry.clone();
  const sourcePosition = sourceGeometry.getAttribute("position");
  const sourceUv = sourceGeometry.getAttribute("uv");
  if (!sourcePosition || !sourceUv)
    throw new Error("Grass shadow caster requires positions and UVs");

  const bladeVertexCount = sourcePosition.count;
  const vertexCount = bladeVertexCount * grassConfig.BLADES_PER_CLUMP;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const bladeSlots = new Float32Array(vertexCount);

  for (let bladeSlot = 0; bladeSlot < grassConfig.BLADES_PER_CLUMP; bladeSlot++) {
    for (let sourceIndex = 0; sourceIndex < bladeVertexCount; sourceIndex++) {
      const targetIndex = bladeSlot * bladeVertexCount + sourceIndex;
      positions[targetIndex * 3] = sourcePosition.getX(sourceIndex);
      positions[targetIndex * 3 + 1] = sourcePosition.getY(sourceIndex);
      positions[targetIndex * 3 + 2] = sourcePosition.getZ(sourceIndex);
      uvs[targetIndex * 2] = sourceUv.getX(sourceIndex);
      uvs[targetIndex * 2 + 1] = sourceUv.getY(sourceIndex);
      bladeSlots[targetIndex] = bladeSlot;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute(
    "grassBladeSlot",
    new Float32BufferAttribute(bladeSlots, 1),
  );
  return geometry;
};

export class GrassShadowCasterBucket {
  readonly geometry: BufferGeometry;
  readonly workItemsAttribute: StorageBufferAttribute;

  private renderer: WebGPURenderer;
  private residency: ShadowResidency;
  private compute: GrassCompute;
  private minimumWorldY: Node<"float">;
  private maximumWorldY: Node<"float">;
  private sunDirection: Node<"vec3">;
  private indirectArguments: IndirectStorageBufferAttribute;
  private resetNode;
  private buildNode;

  constructor(
    renderer: WebGPURenderer,
    residency: ShadowResidency,
    source: Mesh,
    compute: GrassCompute,
    minimumWorldY: Node<"float">,
    maximumWorldY: Node<"float">,
    sunDirection: Node<"vec3">,
  ) {
    this.renderer = renderer;
    this.residency = residency;
    this.compute = compute;
    this.minimumWorldY = minimumWorldY;
    this.maximumWorldY = maximumWorldY;
    this.sunDirection = sunDirection;
    this.geometry = createGrassShadowGeometry(source);
    const position = this.geometry.getAttribute("position");
    this.workItemsAttribute = new StorageBufferAttribute(
      new Uint32Array(
        grassConfig.CLUMP_COUNT * SHADOW_PAGE_LEVEL_COUNT * 4,
      ),
      4,
    );
    this.indirectArguments = new IndirectStorageBufferAttribute(
      new Uint32Array([position.count, 0, 0, 0]),
      1,
    );
    this.geometry.setIndirect(this.indirectArguments);

    const nodes = this.createComputeNodes();
    this.resetNode = nodes.reset;
    this.buildNode = nodes.build;
  }

  run() {
    this.renderer.compute(this.resetNode);
    this.renderer.compute(this.buildNode);
  }

  private createComputeNodes() {
    const workItems = storage(
      this.workItemsAttribute,
      "uvec4",
      this.workItemsAttribute.count,
    );
    const indirectArguments = storage(
      this.indirectArguments,
      "uint",
      this.indirectArguments.count,
    ).toAtomic();

    const reset = Fn(() => {
      atomicStore(indirectArguments.element(1), 0);
    })().compute(1);
    reset.name = "Reset grass shadow caster worklist";

    const build = Fn(() => {
      const clumpIndex = instanceIndex;
      const clumpState = this.compute.clumpStateBuffer.element(clumpIndex);
      const hasGrass = step(
        grassConfig.MIN_VISIBLE_SCALE,
        clumpState.z.mul(grassUniforms.uBladeMaxScale),
      );
      If(hasGrass.greaterThan(0), () => {
        const worldPosition = vec3(
          clumpState.x.add(grassUniforms.uPlayerPosition.x),
          getYOffset(clumpState),
          clumpState.y.add(grassUniforms.uPlayerPosition.z),
        );
        Loop(
          { start: 0, end: SHADOW_PAGE_LEVEL_COUNT, type: "uint" },
          ({ i: level }) => {
            const address = computeGpuShadowPageAddress({
              worldPosition,
              sunDirection: this.sunDirection,
              minimumWorldY: this.minimumWorldY,
              maximumWorldY: this.maximumWorldY,
              level,
            });
            const pageKey = encodeGpuShadowPageKey(level, address.pageId);
            const mapping = this.residency.resolvePage(pageKey);
            If(mapping.isResident, () => {
              const outputIndex = atomicAdd(indirectArguments.element(1), 1);
              If(outputIndex.lessThan(this.workItemsAttribute.count), () => {
                workItems
                  .element(outputIndex)
                  .assign(uvec4(pageKey, mapping.slot, clumpIndex, uint(0)));
              });
            });
          },
        );
      });
    })().compute(grassConfig.CLUMP_COUNT, [grassConfig.WORKGROUP_SIZE]);
    build.name = "Build grass shadow caster worklist";

    return { reset, build };
  }
}
