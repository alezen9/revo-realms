import { Matrix4, Sphere, type BufferGeometry } from "three";
import {
  Fn,
  If,
  Return,
  atomicAdd,
  atomicStore,
  instanceIndex,
  instancedArray,
  storage,
} from "three/tsl";
import {
  IndirectStorageBufferAttribute,
  StorageInstancedBufferAttribute,
} from "three/webgpu";
import { stage } from "../../systems";
import { computeSphereFrustumVisibility } from "../../shaders/frustum";

// indexCount, instanceCount, firstIndex, baseVertex, firstInstance
const DRAW_ARGUMENTS_STRIDE = 5;
const INSTANCE_COUNT_INDEX = 1;
// bark and canopy
const PART_COUNT = 2;
const WORKGROUP_SIZE = 64;

const createMatricesNode = (attribute: StorageInstancedBufferAttribute) =>
  storage(attribute, "mat4", attribute.count);
const createDrawArgumentsNode = (attribute: IndirectStorageBufferAttribute) =>
  storage(attribute, "uint", attribute.count).toAtomic();

type MatricesNode = ReturnType<typeof createMatricesNode>;
type BoundsNode = ReturnType<typeof createBoundsBuffer>;
type DrawArgumentsNode = ReturnType<typeof createDrawArgumentsNode>;

const createBoundsBuffer = (matrices: Float32Array, bounds: Sphere) => {
  const values = new Float32Array((matrices.length / 16) * 4);
  const sphere = new Sphere();
  const matrix = new Matrix4();
  for (let index = 0; index < matrices.length / 16; index++) {
    matrix.fromArray(matrices, index * 16);
    sphere.copy(bounds).applyMatrix4(matrix);
    sphere.center.toArray(values, index * 4);
    values[index * 4 + 3] = sphere.radius;
  }
  return instancedArray(values, "vec4");
};

const createDrawArguments = (geometries: BufferGeometry[]) => {
  const hasEveryPart = geometries.length === PART_COUNT;
  if (!hasEveryPart)
    throw new Error(`Pines draw ${PART_COUNT} parts, got ${geometries.length}`);
  const drawArguments = new Uint32Array(PART_COUNT * DRAW_ARGUMENTS_STRIDE);
  geometries.forEach(({ index, name }, draw) => {
    if (!index) throw new Error(`Pine geometry "${name}" has no index`);
    drawArguments[draw * DRAW_ARGUMENTS_STRIDE] = index.count;
  });
  return drawArguments;
};

const resetInstanceCounts = Fn<[drawArguments: DrawArgumentsNode], void>(
  ([drawArguments]) => {
    for (let draw = 0; draw < PART_COUNT; draw++) {
      const instanceCountIndex = draw * DRAW_ARGUMENTS_STRIDE;
      atomicStore(
        drawArguments.element(instanceCountIndex + INSTANCE_COUNT_INDEX),
        0,
      );
    }
  },
);

const cullPines = Fn<
  [
    placementMatrices: MatricesNode,
    bounds: BoundsNode,
    visibleMatrices: MatricesNode,
    drawArguments: DrawArgumentsNode,
  ],
  void
>(([placementMatrices, bounds, visibleMatrices, drawArguments]) => {
  const sphere = bounds.element(instanceIndex);
  const isVisible = computeSphereFrustumVisibility(
    sphere.xyz,
    sphere.w,
    stage.uFrustumPlanes,
  );
  If(isVisible.equal(0), () => {
    Return();
  });

  // every part of a pine draws the same visible list, so only the first count hands out slots
  const slot = atomicAdd(drawArguments.element(INSTANCE_COUNT_INDEX), 1);
  for (let draw = 1; draw < PART_COUNT; draw++) {
    const instanceCountIndex = draw * DRAW_ARGUMENTS_STRIDE;
    atomicAdd(
      drawArguments.element(instanceCountIndex + INSTANCE_COUNT_INDEX),
      1,
    );
  }
  visibleMatrices
    .element(slot)
    .assign(placementMatrices.element(instanceIndex));
});

export class PineTreesCompute {
  readonly drawArgumentsAttribute: IndirectStorageBufferAttribute;
  // three's instancing reads this as instanceMatrix, so on the gpu instance i is
  // the i-th visible pine, while the cpu copy keeps every pine for vsm to read
  readonly visibleMatrices: StorageInstancedBufferAttribute;
  readonly computeResetInstanceCounts;
  readonly computeCull;

  constructor(matrices: Float32Array, geometries: BufferGeometry[]) {
    this.drawArgumentsAttribute = new IndirectStorageBufferAttribute(
      createDrawArguments(geometries),
      1,
    );
    this.visibleMatrices = new StorageInstancedBufferAttribute(
      matrices.slice(),
      16,
    );
    const placementMatrices = new StorageInstancedBufferAttribute(matrices, 16);
    this.drawArgumentsAttribute.name = "pineTrees.drawArguments";
    this.visibleMatrices.name = "pineTrees.visibleMatrices";
    placementMatrices.name = "pineTrees.placementMatrices";

    const bounds = new Sphere();
    for (const geometry of geometries) {
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      if (geometry.boundingSphere) bounds.union(geometry.boundingSphere);
    }

    const drawArguments = createDrawArgumentsNode(this.drawArgumentsAttribute);
    this.computeResetInstanceCounts = resetInstanceCounts(
      drawArguments,
    ).compute(1, [1]);
    this.computeCull = cullPines(
      createMatricesNode(placementMatrices),
      createBoundsBuffer(matrices, bounds),
      createMatricesNode(this.visibleMatrices),
      drawArguments,
    ).compute(matrices.length / 16, [WORKGROUP_SIZE]);
  }

  getDrawArgumentsOffset(draw: number) {
    return draw * DRAW_ARGUMENTS_STRIDE * Uint32Array.BYTES_PER_ELEMENT;
  }
}
