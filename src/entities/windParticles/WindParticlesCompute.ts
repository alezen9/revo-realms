import {
  float,
  floor,
  Fn,
  hash,
  If,
  instancedArray,
  instanceIndex,
  mix,
  mod,
  step,
  texture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { type Node } from "three/webgpu";
import { assets, wind } from "../../systems";
import { gameTime } from "../../systems/time/gameTime";
import { computeMapUvByPosition } from "../../shaders/mapping";
import { config, uniforms } from "./WindParticlesConfig";

const createParticleBuffer = () =>
  instancedArray(config.PARTICLE_COUNT, "vec4");
type ParticleBuffer = ReturnType<typeof createParticleBuffer>;

const initParticles = Fn<[particles: ParticleBuffer], void>(([particles]) => {
  const data = particles.element(instanceIndex);
  const particleIndex = float(instanceIndex);
  const row = floor(particleIndex.div(config.PARTICLES_PER_SIDE));
  const col = particleIndex.sub(row.mul(config.PARTICLES_PER_SIDE));
  const seed = hash(particleIndex);
  const variation = hash(particleIndex.add(config.VARIATION_SEED_OFFSET));
  const offsetX = col
    .add(seed)
    .mul(config.PARTICLE_SPACING)
    .sub(config.FIELD_HALF_SIZE);
  const offsetZ = row
    .add(variation)
    .mul(config.PARTICLE_SPACING)
    .sub(config.FIELD_HALF_SIZE);
  const worldPosition = vec3(offsetX, 0, offsetZ).add(uniforms.uPlayerPosition);
  const mapUv = computeMapUvByPosition(worldPosition.xz);
  const heightUv = vec2(mapUv.x, float(1).sub(mapUv.y));
  const terrainHeight = texture(assets.resources.heightmap, heightUv).r;
  const grassMapValue = texture(
    assets.resources.terrainMasks,
    computeMapUvByPosition(worldPosition.xz),
  ).g;
  const isSpawnValid = step(0.25, grassMapValue);
  const heightOffset = mix(0.25, uniforms.uHeight.mul(0.85), variation);
  const spawnHeight = terrainHeight.add(heightOffset).mul(isSpawnValid);
  const age = seed
    .mul(config.PARTICLE_LIFETIME + config.RESPAWN_DELAY)
    .sub(config.RESPAWN_DELAY);

  data.assign(vec4(offsetX, spawnHeight, offsetZ, age));
});

const updateParticles = Fn<
  [particles: ParticleBuffer, maxTerrainHeight: Node<"float">],
  void
>(([particles, maxTerrainHeight]) => {
  const data = particles.element(instanceIndex);
  const particleIndex = float(instanceIndex);
  const seed = hash(particleIndex);
  const variation = hash(particleIndex.add(config.VARIATION_SEED_OFFSET));
  const sideDirection = vec2(wind.uDirection.y.negate(), wind.uDirection.x);
  const age = data.w.add(uniforms.uDelta.mul(uniforms.uSpeed));
  const isAlive = step(0, age);
  const lifetime = mix(
    config.PARTICLE_LIFETIME * 0.82,
    config.PARTICLE_LIFETIME * 1.18,
    variation,
  );
  const unwrappedOffset = data.xz.sub(uniforms.uPlayerDeltaXZ);
  const wrappedOffsetX = mod(
    unwrappedOffset.x.add(config.FIELD_HALF_SIZE),
    config.FIELD_SIZE,
  ).sub(config.FIELD_HALF_SIZE);
  const wrappedOffsetZ = mod(
    unwrappedOffset.y.add(config.FIELD_HALF_SIZE),
    config.FIELD_SIZE,
  ).sub(config.FIELD_HALF_SIZE);
  const wrappedOffset = vec3(wrappedOffsetX, 0, wrappedOffsetZ);
  const worldPosition = wrappedOffset.add(uniforms.uPlayerPosition);
  const flowUv = worldPosition.xz
    .mul(0.018)
    .add(vec2(gameTime.mul(0.035), gameTime.mul(0.021)));
  const flow = texture(assets.resources.noiseAtlas, flowUv);
  const forwardVelocity = float(config.PARTICLE_SPEED)
    .mul(uniforms.uSpeed)
    .mul(mix(0.78, 1.42, seed))
    .mul(mix(0.78, 1.22, flow.b))
    .mul(mix(0.6, 1.15, wind.uIntensityDirectional));
  const sideVelocity = flow.r
    .mul(2)
    .sub(1)
    .mul(mix(5, 13, variation))
    .mul(uniforms.uTurbulence)
    .mul(uniforms.uSpeed)
    .mul(mix(0.4, 1, wind.uIntensityDirectional));
  const travel = wind.uDirection
    .mul(forwardVelocity)
    .add(sideDirection.mul(sideVelocity))
    .mul(uniforms.uDelta)
    .mul(isAlive);
  const travelledOffset = wrappedOffset.xz.add(travel);
  const positionX = mod(
    travelledOffset.x.add(config.FIELD_HALF_SIZE),
    config.FIELD_SIZE,
  ).sub(config.FIELD_HALF_SIZE);
  const positionZ = mod(
    travelledOffset.y.add(config.FIELD_HALF_SIZE),
    config.FIELD_SIZE,
  ).sub(config.FIELD_HALF_SIZE);
  const isSpawnValid = step(0.001, data.y);
  const verticalFlow = flow.g.mul(2).sub(1);
  const seedResponse = mix(0.35, 0.9, seed);
  const windResponse = mix(0.45, 1.1, wind.uIntensityDirectional);
  const verticalVelocity = verticalFlow
    .mul(seedResponse)
    .mul(uniforms.uTurbulence)
    .mul(uniforms.uSpeed)
    .mul(windResponse);
  const maxHeight = uniforms.uHeight.add(maxTerrainHeight);
  const verticalStep = verticalVelocity.mul(uniforms.uDelta).mul(isAlive);
  const nextHeight = data.y.add(verticalStep).clamp(0.12, maxHeight);

  data.x = positionX;
  data.y = nextHeight.mul(isSpawnValid);
  data.z = positionZ;
  data.w = age;

  const isExpired = step(lifetime, age);
  If(isExpired, () => {
    const row = floor(particleIndex.div(config.PARTICLES_PER_SIDE));
    const col = particleIndex.sub(row.mul(config.PARTICLES_PER_SIDE));
    const spawnForward = row
      .add(seed)
      .div(config.PARTICLES_PER_SIDE)
      .mul(config.FIELD_HALF_SIZE)
      .sub(config.FIELD_HALF_SIZE);
    const spawnSide = col
      .add(variation)
      .div(config.PARTICLES_PER_SIDE)
      .mul(config.FIELD_SIZE)
      .sub(config.FIELD_HALF_SIZE);
    const spawnPosition = wind.uDirection
      .mul(spawnForward)
      .add(sideDirection.mul(spawnSide));
    const spawnWorldPosition = vec3(spawnPosition.x, 0, spawnPosition.y).add(
      uniforms.uPlayerPosition,
    );
    const spawnMapUv = computeMapUvByPosition(spawnWorldPosition.xz);
    const spawnHeightUv = vec2(spawnMapUv.x, float(1).sub(spawnMapUv.y));
    const terrainHeight = texture(assets.resources.heightmap, spawnHeightUv).r;
    const spawnGrassMapValue = texture(
      assets.resources.terrainMasks,
      computeMapUvByPosition(spawnWorldPosition.xz),
    ).g;
    const isSpawnValid = step(0.25, spawnGrassMapValue);
    const heightOffset = mix(0.25, uniforms.uHeight.mul(0.85), variation);
    const spawnHeight = terrainHeight.add(heightOffset).mul(isSpawnValid);
    const respawnAge = variation.mul(config.RESPAWN_DELAY).negate();

    data.assign(
      vec4(spawnPosition.x, spawnHeight, spawnPosition.y, respawnAge),
    );
  });
});

export class WindParticlesCompute {
  // x -> local offsetX
  // y -> world height (0 when the spawn is outside grass)
  // z -> local offsetZ
  // w -> age (negative during the respawn delay)
  readonly particles = createParticleBuffer();
  readonly computeInit;
  readonly computeUpdate;

  constructor() {
    this.particles.value.name = "windParticles.particles";
    const maxTerrainHeight = Math.ceil(assets.resources.heightmap.userData.max);
    const workgroup = [config.WORKGROUP_SIZE];
    this.computeInit = initParticles(this.particles).compute(
      config.PARTICLE_COUNT,
      workgroup,
    );
    this.computeUpdate = updateParticles(
      this.particles,
      float(maxTerrainHeight),
    ).compute(config.PARTICLE_COUNT, workgroup);
  }
}
