import { Vector3 } from "three";
import { uniform } from "three/tsl";

const getConfig = () => {
  const SEGMENTS_X = 24;
  const SEGMENTS_Y = 16;
  const POINTS_X = SEGMENTS_X + 1;
  const POINTS_Y = SEGMENTS_Y + 1;
  const FLAG_WIDTH = 5.4;
  const FLAG_HEIGHT = 3.3;
  const STAFF_HEIGHT = 6.5;
  const STAFF_RADIUS = 0.07;
  const SIM_DISTANCE = 80;

  return {
    SEGMENTS_X,
    SEGMENTS_Y,
    POINTS_X,
    POINTS_Y,
    COUNT: POINTS_X * POINTS_Y,
    REST_X: FLAG_WIDTH / SEGMENTS_X,
    REST_Y: FLAG_HEIGHT / SEGMENTS_Y,
    FLAG_WIDTH,
    FLAG_HEIGHT,
    STAFF_HEIGHT,
    STAFF_RADIUS,
    STAFF_LEAN_RADIANS: (8 * Math.PI) / 180,
    ATTACH_TOP: STAFF_HEIGHT - 0.2,
    SIM_DISTANCE_SQUARED: SIM_DISTANCE * SIM_DISTANCE,
    MAX_STEP: 0.15,
    WORKGROUP_SIZE: 64,
  };
};

export const config = getConfig();

export const uniforms = {
  // simulation
  uDelta: uniform(0),
  uStiffness: uniform(1),
  uDamping: uniform(2),
  uGravity: uniform(8),
  uThickness: uniform(0.2),
  uStaffAxis: uniform(new Vector3(0, 1, 0)),
  // player
  uPlayerLocalPosition: uniform(new Vector3(0, -100, 0)),
  uPlayerRadius: uniform(0.5),
  uCollisionPadding: uniform(0.2),
  // wind
  uWindStrength: uniform(0.15),
  uWindForce: uniform(45),
  uGustStrength: uniform(0.5),
  uGustSpeed: uniform(0.1),
  uFlutter: uniform(3),
  // material
  uDiffuseScale: uniform(2),
  uEmissive: uniform(15),
};
