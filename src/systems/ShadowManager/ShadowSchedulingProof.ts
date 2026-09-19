import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  OrthographicCamera,
  Scene,
  Vector2,
} from "three";
import {
  IndirectStorageBufferAttribute,
  MeshBasicNodeMaterial,
  StorageBufferAttribute,
  type WebGPURenderer,
} from "three/webgpu";
import {
  atomicLoad,
  atomicOr,
  atomicStore,
  Fn,
  If,
  instanceIndex,
  storage,
  texture,
  textureLoad,
  uniform,
  uint,
  uvec2,
} from "three/tsl";
import type { Texture } from "three";

const PROBE_GRID_SIZE = 64;
const PROBE_SAMPLE_COUNT = PROBE_GRID_SIZE * PROBE_GRID_SIZE;
const RECEIVER_FOUND_BIT = 1;
const MSAA_EDGE_FOUND_BIT = 2;

export class ShadowSchedulingProof {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  private renderer: WebGPURenderer;
  private depthSize = uniform(new Vector2(1, 1));
  private indirectDrawArguments = new IndirectStorageBufferAttribute(
    new Uint32Array([3, 0, 0, 0]),
    1,
  );
  private atomicIndirectDrawArguments = storage(
    this.indirectDrawArguments,
    "uint",
    this.indirectDrawArguments.count,
  ).toAtomic();
  private proofFlags = new StorageBufferAttribute(new Uint32Array(1), 1);
  private atomicProofFlags = storage(
    this.proofFlags,
    "uint",
    this.proofFlags.count,
  ).toAtomic();
  private computeNodes;

  constructor(renderer: WebGPURenderer, depthTexture: Texture) {
    this.renderer = renderer;
    this.computeNodes = this.createComputeNodes(depthTexture);

    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute([-1, -1, -0.5, 3, -1, -0.5, -1, 3, -0.5], 3),
    );
    geometry.setIndirect(this.indirectDrawArguments);

    const material = new MeshBasicNodeMaterial();
    material.colorWrite = false;
    material.depthTest = false;
    material.depthWrite = true;

    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  run() {
    this.renderer.getDrawingBufferSize(this.depthSize.value);
    this.renderer.compute(this.computeNodes);
  }

  private createComputeNodes(depthTexture: Texture) {
    const depthTextureNode = texture(depthTexture);
    const reset = Fn(() => {
      atomicStore(this.atomicProofFlags.element(0), 0);
      atomicStore(this.atomicIndirectDrawArguments.element(1), 0);
    })().compute(1, [1]);

    const scan = Fn(() => {
      const x = instanceIndex.mod(PROBE_GRID_SIZE);
      const y = instanceIndex.div(PROBE_GRID_SIZE);
      const maxPixel = uvec2(this.depthSize).sub(1);
      const pixel = uvec2(x, y).mul(maxPixel).div(PROBE_GRID_SIZE - 1);
      const depth0 = textureLoad(depthTextureNode, pixel).level(uint(0)).r;
      const depth1 = textureLoad(depthTextureNode, pixel).level(uint(1)).r;
      const depth2 = textureLoad(depthTextureNode, pixel).level(uint(2)).r;
      const depth3 = textureLoad(depthTextureNode, pixel).level(uint(3)).r;
      const minimumDepth = depth0.min(depth1).min(depth2).min(depth3);
      const hasSampleDifference = depth0
        .notEqual(depth1)
        .or(depth0.notEqual(depth2))
        .or(depth0.notEqual(depth3));

      If(minimumDepth.lessThan(1), () => {
        atomicOr(this.atomicProofFlags.element(0), uint(RECEIVER_FOUND_BIT));
      });
      If(hasSampleDifference, () => {
        atomicOr(this.atomicProofFlags.element(0), uint(MSAA_EDGE_FOUND_BIT));
      });
    })().compute(PROBE_SAMPLE_COUNT, [64]);

    const finalize = Fn(() => {
      const flags = atomicLoad(this.atomicProofFlags.element(0));
      If(
        flags
          .bitAnd(RECEIVER_FOUND_BIT | MSAA_EDGE_FOUND_BIT)
          .equal(RECEIVER_FOUND_BIT | MSAA_EDGE_FOUND_BIT),
        () => {
          atomicStore(this.atomicIndirectDrawArguments.element(1), 1);
        },
      );
    })().compute(1, [1]);

    reset.name = "Shadow scheduling proof reset";
    scan.name = "Shadow scheduling proof depth scan";
    finalize.name = "Shadow scheduling proof finalize";

    return [reset, scan, finalize];
  }
}
