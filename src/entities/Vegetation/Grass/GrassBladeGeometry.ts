import { BufferAttribute, InstancedBufferGeometry } from "three";

type GrassBladeGeometryParams = {
  nSegments: number;
  bladeHeight: number;
};

const getBladeHalfWidth = (t: number, halfWidthBase: number) => {
  const baseGrow = Math.min(1, 0.28 + 0.72 * (t / 0.26));

  const tipTaper = Math.pow(1 - t, 1.22);

  return halfWidthBase * baseGrow * tipTaper;
};

export class GrassBladeGeometry extends InstancedBufferGeometry {
  constructor({ nSegments, bladeHeight }: GrassBladeGeometryParams) {
    super();

    const segments = Math.max(1, Math.floor(nSegments));

    const halfWidthBase = 0.5;
    const rowCount = segments;
    const vertexCount = rowCount * 2 + 1;
    const quadCount = Math.max(0, rowCount - 1);
    const indexCount = quadCount * 6 + 3;

    const positions = new Float32Array(vertexCount * 3);

    const uvs = new Float32Array(vertexCount * 2);

    const indices = new Uint16Array(indexCount);

    let indexOffset = 0;

    for (let row = 0; row < rowCount; row++) {
      const v = row / segments;
      const y = v * bladeHeight;
      const halfWidth = getBladeHalfWidth(v, halfWidthBase);

      const left = row * 2;
      const right = left + 1;

      positions[3 * left] = -halfWidth;
      positions[3 * left + 1] = y;

      positions[3 * right] = halfWidth;
      positions[3 * right + 1] = y;

      uvs[2 * left + 1] = v;
      uvs[2 * right] = 1;
      uvs[2 * right + 1] = v;

      if (row === 0) continue;

      const previousLeft = (row - 1) * 2;
      const previousRight = previousLeft + 1;

      indices[indexOffset++] = previousLeft;
      indices[indexOffset++] = previousRight;
      indices[indexOffset++] = right;
      indices[indexOffset++] = previousLeft;
      indices[indexOffset++] = right;
      indices[indexOffset++] = left;
    }

    const tip = rowCount * 2;

    positions[3 * tip + 1] = bladeHeight;

    uvs[2 * tip] = 0.5;
    uvs[2 * tip + 1] = 1;

    const lastLeft = (rowCount - 1) * 2;
    const lastRight = lastLeft + 1;

    indices[indexOffset++] = lastLeft;
    indices[indexOffset++] = lastRight;
    indices[indexOffset] = tip;

    this.setAttribute("position", new BufferAttribute(positions, 3));

    this.setAttribute("uv", new BufferAttribute(uvs, 2));

    this.setIndex(new BufferAttribute(indices, 1));
  }
}
