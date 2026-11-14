import { BufferAttribute, BufferGeometry } from "three";

export const BODY_HALF_WIDTH = 0.07;

// seen from above, nose toward +z, the wings are everything wider than the body
const POSITIONS = new Float32Array([
  0,
  0,
  0.5, // nose
  BODY_HALF_WIDTH,
  0,
  0.15,
  -BODY_HALF_WIDTH,
  0,
  0.15,
  BODY_HALF_WIDTH,
  0,
  -0.15,
  -BODY_HALF_WIDTH,
  0,
  -0.15,
  0.11,
  0,
  -0.5, // tail
  -0.11,
  0,
  -0.5,
  0.55,
  0,
  0.1, // right wing bend
  1,
  0,
  -0.12, // right wing tip
  -0.55,
  0,
  0.1, // left wing bend
  -1,
  0,
  -0.12, // left wing tip
]);

const INDICES = new Uint16Array([
  0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6, 1, 7, 3, 7, 8, 3, 2, 4, 9, 9, 4,
  10,
]);

export const createPampasBirdsGeometry = () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(POSITIONS, 3));
  geometry.setIndex(new BufferAttribute(INDICES, 1));
  return geometry;
};
