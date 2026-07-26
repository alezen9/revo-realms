import { Color } from "three";
import {
  float,
  floor,
  Fn,
  hash,
  If,
  instancedArray,
  instanceIndex,
  mix,
  smoothstep,
  step,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  CircleGeometry,
  InstancedMesh,
  SpriteNodeMaterial,
  Vector2,
  Vector3,
} from "three/webgpu";
import { type State } from "../../Game";
import type { ComputeTask } from "../../systems/RendererManager/ComputeTask";
import {
  assetManager,
  debugManager,
  eventsManager,
  prewarmManager,
  rendererManager,
  sceneManager,
  windManager,
} from "../../systems";
import { gameTime } from "../../utils/GameTime";
import { TSLUtils } from "../../utils/TSLUtils";
import { VegetationSsboUtils } from "../Vegetation/ssboUtils";

const uniforms = {
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),
  uPlayerPosition: uniform(new Vector3()),
  uDelta: uniform(0),
  uColor: uniform(new Color().setRGB(0.27, 0.31, 0.28)),
  uSpeed: uniform(0.5),
  uTurbulence: uniform(1.25),
  uHeight: uniform(3.3),
  uSize: uniform(0.6),
};

const getConfig = () => {
  const PARTICLES_PER_SIDE = 64;
  const FIELD_SIZE = 170;

  return {
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
};

const config = getConfig();

class WindParticlesSsbo {
  // x -> local offsetX
  // y -> world height (0 when the spawn is outside grass)
  // z -> local offsetZ
  // w -> age (negative during the respawn delay)
  private buffer = instancedArray(config.PARTICLE_COUNT, "vec4");
  private readonly maxTerrainHeight = Math.ceil(
    assetManager.resources.heightmap.userData.max,
  );

  get computeBuffer() {
    return this.buffer;
  }

  readonly computeInit = Fn(() => {
    const data = this.buffer.element(instanceIndex);
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
    const worldPosition = vec3(offsetX, 0, offsetZ).add(
      uniforms.uPlayerPosition,
    );
    const terrainHeight = VegetationSsboUtils.computeYOffset(worldPosition);
    const grassMapValue = texture(
      assetManager.resources.terrainMaps,
      TSLUtils.computeMapUvByPosition(worldPosition.xz),
    ).g;
    const isSpawnValid = VegetationSsboUtils.computeGrassMask(grassMapValue);
    const heightOffset = mix(0.25, uniforms.uHeight.mul(0.85), variation);
    const spawnHeight = terrainHeight.add(heightOffset).mul(isSpawnValid);
    const age = seed
      .mul(config.PARTICLE_LIFETIME + config.RESPAWN_DELAY)
      .sub(config.RESPAWN_DELAY);

    data.assign(vec4(offsetX, spawnHeight, offsetZ, age));
  })().compute(config.PARTICLE_COUNT, [config.WORKGROUP_SIZE]);

  readonly computeUpdate = Fn(() => {
    const data = this.buffer.element(instanceIndex);
    const particleIndex = float(instanceIndex);
    const seed = hash(particleIndex);
    const variation = hash(particleIndex.add(config.VARIATION_SEED_OFFSET));
    const sideDirection = vec2(
      windManager.uDirection.y.negate(),
      windManager.uDirection.x,
    );
    const age = data.w.add(uniforms.uDelta.mul(uniforms.uSpeed));
    const isAlive = step(0, age);
    const lifetime = mix(
      config.PARTICLE_LIFETIME * 0.82,
      config.PARTICLE_LIFETIME * 1.18,
      variation,
    );
    const unwrappedOffset = data.xz.sub(uniforms.uPlayerDeltaXZ);
    const wrappedOffset = VegetationSsboUtils.wrapPosition(
      unwrappedOffset,
      config.FIELD_SIZE,
    );
    const worldPosition = wrappedOffset.add(uniforms.uPlayerPosition);
    const flowUv = worldPosition.xz
      .mul(0.018)
      .add(vec2(gameTime.mul(0.035), gameTime.mul(0.021)));
    const flow = texture(assetManager.resources.noiseAtlas, flowUv);
    const forwardVelocity = float(config.PARTICLE_SPEED)
      .mul(uniforms.uSpeed)
      .mul(mix(0.78, 1.42, seed))
      .mul(mix(0.78, 1.22, flow.b))
      .mul(mix(0.6, 1.15, windManager.uIntensityDirectional));
    const sideVelocity = flow.r
      .mul(2)
      .sub(1)
      .mul(mix(5, 13, variation))
      .mul(uniforms.uTurbulence)
      .mul(uniforms.uSpeed)
      .mul(mix(0.4, 1, windManager.uIntensityDirectional));
    const travel = windManager.uDirection
      .mul(forwardVelocity)
      .add(sideDirection.mul(sideVelocity))
      .mul(uniforms.uDelta)
      .mul(isAlive);
    const position = VegetationSsboUtils.wrapPosition(
      wrappedOffset.xz.add(travel),
      config.FIELD_SIZE,
    );
    const isSpawnValid = step(0.001, data.y);
    const verticalVelocity = flow.g
      .mul(2)
      .sub(1)
      .mul(mix(0.35, 0.9, seed))
      .mul(uniforms.uTurbulence)
      .mul(uniforms.uSpeed)
      .mul(mix(0.45, 1.1, windManager.uIntensityDirectional));
    const maxHeight = uniforms.uHeight.add(this.maxTerrainHeight);

    data.x = position.x;
    data.y = data.y
      .add(verticalVelocity.mul(uniforms.uDelta).mul(isAlive))
      .clamp(0.12, maxHeight)
      .mul(isSpawnValid);
    data.z = position.z;
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
      const spawnPosition = windManager.uDirection
        .mul(spawnForward)
        .add(sideDirection.mul(spawnSide));
      const spawnWorldPosition = vec3(spawnPosition.x, 0, spawnPosition.y).add(
        uniforms.uPlayerPosition,
      );
      const terrainHeight =
        VegetationSsboUtils.computeYOffset(spawnWorldPosition);
      const spawnGrassMapValue = texture(
        assetManager.resources.terrainMaps,
        TSLUtils.computeMapUvByPosition(spawnWorldPosition.xz),
      ).g;
      const isSpawnValid =
        VegetationSsboUtils.computeGrassMask(spawnGrassMapValue);
      const heightOffset = mix(0.25, uniforms.uHeight.mul(0.85), variation);
      const spawnHeight = terrainHeight.add(heightOffset).mul(isSpawnValid);
      const respawnAge = variation.mul(config.RESPAWN_DELAY).negate();

      data.assign(
        vec4(spawnPosition.x, spawnHeight, spawnPosition.y, respawnAge),
      );
    });
  })().compute(config.PARTICLE_COUNT, [config.WORKGROUP_SIZE]);
}

export default class WindAmbianceParticles {
  private ssbo = new WindParticlesSsbo();
  private computeTask: ComputeTask;
  private mesh: InstancedMesh;

  constructor() {
    this.computeTask = rendererManager.createComputeTask({
      label: "WindAmbianceParticles",
      init: this.ssbo.computeInit,
      update: this.ssbo.computeUpdate,
    });
    this.mesh = this.createMesh();
    sceneManager.scene.add(this.mesh);
    this.computeTask.init();
    this.registerPrewarmTask();
    eventsManager.on("engine-render-update", this.onEngineUpdate);
    this.debug();
  }

  private createMesh() {
    const mesh = new InstancedMesh(
      new CircleGeometry(0.5, 8),
      new WindParticleMaterial(this.ssbo),
      config.PARTICLE_COUNT,
    );
    mesh.visible = false;
    mesh.frustumCulled = false;
    return mesh;
  }

  private registerPrewarmTask() {
    prewarmManager.registerTask({
      prepare: async () => {
        this.mesh.visible = true;
        await this.computeTask.init();
        await this.computeTask.update();
      },
      restore: () => {},
    });
  }

  private onEngineUpdate = ({ player, delta }: State) => {
    const deltaX = player.position.x - this.mesh.position.x;
    const deltaZ = player.position.z - this.mesh.position.z;
    uniforms.uPlayerDeltaXZ.value.set(deltaX, deltaZ);
    uniforms.uPlayerPosition.value.copy(player.position);
    uniforms.uDelta.value = delta;
    this.mesh.position.copy(player.position).setY(0);
    this.mesh.visible = true;
    this.updateSsbo();
  };

  private updateSsbo() {
    void this.computeTask.update()?.catch(() => undefined);
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
      title: "🌬️ Wind particles",
      expanded: false,
    });

    folder.addBinding(uniforms.uColor, "value", {
      label: "Color",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.uSpeed, "value", {
      label: "Speed",
      min: 0,
      max: 3,
      step: 0.01,
    });
    folder.addBinding(uniforms.uTurbulence, "value", {
      label: "Turbulence",
      min: 0,
      max: 3,
      step: 0.01,
    });
    folder.addBinding(uniforms.uHeight, "value", {
      label: "Height",
      min: 0.5,
      max: 12,
      step: 0.1,
    });
    folder.addBinding(uniforms.uSize, "value", {
      label: "Size",
      min: 0.25,
      max: 4,
      step: 0.01,
    });
  }
}

class WindParticleMaterial extends SpriteNodeMaterial {
  constructor(ssbo: WindParticlesSsbo) {
    super();

    this.precision = "lowp";
    this.transparent = false;
    this.depthWrite = true;
    this.forceSinglePass = true;

    const data = ssbo.computeBuffer.element(instanceIndex);
    const particleIndex = float(instanceIndex);
    const seed = hash(particleIndex);
    const variation = hash(particleIndex.add(config.VARIATION_SEED_OFFSET));
    const lifetime = mix(
      config.PARTICLE_LIFETIME * 0.82,
      config.PARTICLE_LIFETIME * 1.18,
      variation,
    );
    const lifeProgress = data.w.div(lifetime).clamp();
    const lifeFade = smoothstep(0, 0.14, lifeProgress).mul(
      float(1).sub(smoothstep(0.78, 1, lifeProgress)),
    );
    const smallSize = mix(0.03, 0.076, seed);
    const largeSize = mix(0.09, 0.18, variation);
    const isLargeParticle = step(0.66, seed);
    const particleSize = mix(smallSize, largeSize, isLargeParticle);
    const gustVisibility = smoothstep(
      seed.mul(0.55),
      1,
      windManager.uIntensityDirectional,
    );
    const isAlive = step(0, data.w);
    const isSpawnValid = step(0.001, data.y);
    const visibility = isAlive
      .mul(isSpawnValid)
      .mul(lifeFade)
      .mul(gustVisibility);

    this.positionNode = data.xyz;
    this.scaleNode = particleSize.mul(uniforms.uSize).mul(visibility);
    this.colorNode = uniforms.uColor.mul(mix(0.48, 0.72, variation));
  }
}
