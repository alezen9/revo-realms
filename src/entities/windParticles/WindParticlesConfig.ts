import { Color, Vector2, Vector3 } from "three/webgpu";
import { uniform } from "three/tsl";

export const uniforms = {
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),
  uPlayerPosition: uniform(new Vector3()),
  uDelta: uniform(0),
  uColor: uniform(new Color().setRGB(0.27, 0.31, 0.28)),
  uSpeed: uniform(0.5),
  uTurbulence: uniform(1.75),
  uHeight: uniform(3.3),
  uSize: uniform(0.6),
};

const PARTICLES_PER_SIDE = 64;
const FIELD_SIZE = 170;

export const config = {
  PARTICLES_PER_SIDE,
  PARTICLE_COUNT: PARTICLES_PER_SIDE * PARTICLES_PER_SIDE,
  FIELD_SIZE,
  FIELD_HALF_SIZE: FIELD_SIZE / 2,
  PARTICLE_SPACING: FIELD_SIZE / PARTICLES_PER_SIDE,
  PARTICLE_LIFETIME: 6.4,
  PARTICLE_SPEED: 30,
  RESPAWN_DELAY: 2.4,
  VARIATION_SEED_OFFSET: 2048,
  WORKGROUP_SIZE: 64,
};
