import { PlaneGeometry } from "three";

const PETAL_WIDTH = 0.6;
const PETAL_CUP = 0.12;

export const createExpedition33PetalsGeometry = () => {
  const geometry = new PlaneGeometry(PETAL_WIDTH, 1, 2, 4);
  const positions = geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index++) {
    const along = positions.getY(index) + 0.5;
    const profile = Math.sin(Math.PI * Math.min(along * 0.85 + 0.08, 1));
    const x = positions.getX(index) * profile ** 0.7;
    const across = x / (PETAL_WIDTH / 2);
    positions.setXYZ(index, x, positions.getY(index), across ** 2 * PETAL_CUP);
  }
  geometry.computeVertexNormals();
  return geometry;
};
