import {
  BufferAttribute,
  BufferGeometry,
  StaticDrawUsage,
} from "three";

type GrassBladeGeometryParams = {
  nSegments: number;
  bladeHeight: number;
  bladeWidth: number;
};

const getBladeHalfWidth = (t: number, halfWidthBase: number) => {
  const baseGrow = Math.min(1, 0.28 + 0.72 * (t / 0.26));
  const tipTaper = Math.pow(1 - t, 1.22);
  return halfWidthBase * baseGrow * tipTaper;
};

export class GrassBladeGeometry extends BufferGeometry {
  constructor({
    nSegments,
    bladeHeight,
    bladeWidth,
  }: GrassBladeGeometryParams) {
    super();

    const segments = Math.max(1, Math.floor(nSegments));
    const halfWidthBase = bladeWidth * 0.5;

    const rowCount = segments;
    const vertexCount = rowCount * 2 + 1;
    const quadCount = Math.max(0, rowCount - 1);
    const indexCount = quadCount * 6 + 3;

    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = new Uint8Array(indexCount);
    const normals = new Float32Array(vertexCount * 3);

    let idx = 0;
    for (let row = 0; row < rowCount; row++) {
      const v = row / segments;
      const y = v * bladeHeight;
      const halfWidth = getBladeHalfWidth(v, halfWidthBase);

      const left = row * 2;
      const right = left + 1;

      positions[3 * left + 0] = -halfWidth;
      positions[3 * left + 1] = y;
      positions[3 * left + 2] = 0;

      positions[3 * right + 0] = halfWidth;
      positions[3 * right + 1] = y;
      positions[3 * right + 2] = 0;

      uvs[2 * left + 0] = 0;
      uvs[2 * left + 1] = v;
      uvs[2 * right + 0] = 1;
      uvs[2 * right + 1] = v;

      if (row === 0) continue;

      const prevLeft = (row - 1) * 2;
      const prevRight = prevLeft + 1;

      indices[idx++] = prevLeft;
      indices[idx++] = prevRight;
      indices[idx++] = right;
      indices[idx++] = prevLeft;
      indices[idx++] = right;
      indices[idx++] = left;
    }

    const tip = rowCount * 2;
    positions[3 * tip + 0] = 0;
    positions[3 * tip + 1] = bladeHeight;
    positions[3 * tip + 2] = 0;
    uvs[2 * tip + 0] = 0.5;
    uvs[2 * tip + 1] = 1;

    const lastLeft = (rowCount - 1) * 2;
    const lastRight = lastLeft + 1;
    indices[idx++] = lastLeft;
    indices[idx++] = lastRight;
    indices[idx++] = tip;

    const positionAttribute = new BufferAttribute(positions, 3);
    positionAttribute.setUsage(StaticDrawUsage);
    this.setAttribute("position", positionAttribute);

    const uvAttribute = new BufferAttribute(uvs, 2);
    uvAttribute.setUsage(StaticDrawUsage);
    this.setAttribute("uv", uvAttribute);

    const indexAttribute = new BufferAttribute(indices, 1);
    indexAttribute.setUsage(StaticDrawUsage);
    this.setIndex(indexAttribute);

    const normalAttribute = new BufferAttribute(normals, 3);
    normalAttribute.setUsage(StaticDrawUsage);
    this.setAttribute("normal", normalAttribute);
  }
}
