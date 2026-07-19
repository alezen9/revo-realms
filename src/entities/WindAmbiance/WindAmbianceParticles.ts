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
  type ComputeNode,
  InstancedMesh,
  SpriteNodeMaterial,
  Vector2,
  Vector3,
} from "three/webgpu";
import { type State } from "../../Game";
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
import { VegetationSsboUtils } from "../Vegetation/ssboUtils";

const uniforms = {
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),
  uPlayerPosition: uniform(new Vector3()),
  uDelta: uniform(0),
  uColor: uniform(new Color().setRGB(0.27, 0.31, 0.28)),
  uSpeed: uniform(0.5),
  uHeight: uniform(3.3),
  uSize: uniform(0.6),
};

type WindParticleUniforms = typeof uniforms;

const getConfig = () => {
  const PARTICLES_PER_SIDE = 56;
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
    WORKGROUP_SIZE: 64,
  };
};

const config = getConfig();

class WindParticlesSsbo {
  // x -> local offsetX
  // y -> world height
  // z -> local offsetZ
  // w -> age
  private buffer = instancedArray(config.PARTICLE_COUNT, "vec4");
  private uniforms: WindParticleUniforms;
  private computeInit: ComputeNode;
  readonly computeUpdate: ComputeNode;

  constructor() {
    this.uniforms = uniforms;
    this.computeInit = this.createComputeInit();
    this.computeUpdate = this.createComputeUpdate();

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
  }

  get computeBuffer() {
    return this.buffer;
  }

  private createComputeInit() {
    return Fn(() => {
      const data = this.buffer.element(instanceIndex);
      const particleIndex = float(instanceIndex);
      const row = floor(particleIndex.div(config.PARTICLES_PER_SIDE));
      const col = particleIndex.sub(row.mul(config.PARTICLES_PER_SIDE));
      const seed = hash(particleIndex);
      const variation = hash(particleIndex.add(2048));
      const offsetX = col
        .add(seed)
        .mul(config.PARTICLE_SPACING)
        .sub(config.FIELD_HALF_SIZE);
      const offsetZ = row
        .add(variation)
        .mul(config.PARTICLE_SPACING)
        .sub(config.FIELD_HALF_SIZE);
      const worldPosition = vec3(offsetX, 0, offsetZ).add(
        this.uniforms.uPlayerPosition,
      );
      const terrainHeight = VegetationSsboUtils.computeYOffset(worldPosition);
      const isOnGrass = VegetationSsboUtils.computeGrassMask(worldPosition);
      const height = mix(0.25, this.uniforms.uHeight.mul(0.85), variation);
      const age = seed
        .mul(config.PARTICLE_LIFETIME + config.RESPAWN_DELAY)
        .sub(config.RESPAWN_DELAY);

      data.assign(
        vec4(offsetX, terrainHeight.add(height).mul(isOnGrass), offsetZ, age),
      );
    })().compute(config.PARTICLE_COUNT, [config.WORKGROUP_SIZE]);
  }

  private createComputeUpdate() {
    return Fn(() => {
      const data = this.buffer.element(instanceIndex);
      const particleIndex = float(instanceIndex);
      const seed = hash(particleIndex);
      const variation = hash(particleIndex.add(2048));
      const windDirection = windManager.uDirection;
      const windIntensity = windManager.uIntensityDirectional;
      const sideDirection = vec2(windDirection.y.negate(), windDirection.x);
      const age = data.w.add(this.uniforms.uDelta.mul(this.uniforms.uSpeed));
      const isAlive = step(0, age);
      const lifetime = mix(
        config.PARTICLE_LIFETIME * 0.82,
        config.PARTICLE_LIFETIME * 1.18,
        variation,
      );
      const wrappedPosition = VegetationSsboUtils.wrapPosition(
        data.xz,
        this.uniforms.uPlayerDeltaXZ,
        config.FIELD_SIZE,
      );
      const worldPosition = wrappedPosition.add(this.uniforms.uPlayerPosition);
      const flowUv = worldPosition.xz
        .mul(0.018)
        .add(vec2(gameTime.mul(0.035), gameTime.mul(0.021)));
      const flow = texture(assetManager.resources.noiseAtlas, flowUv);
      const forwardVelocity = float(config.PARTICLE_SPEED)
        .mul(this.uniforms.uSpeed)
        .mul(mix(0.78, 1.42, seed))
        .mul(mix(0.78, 1.22, flow.b))
        .mul(mix(0.6, 1.15, windIntensity));
      const sideVelocity = flow.r
        .mul(2)
        .sub(1)
        .mul(mix(5, 13, variation))
        .mul(this.uniforms.uSpeed)
        .mul(mix(0.4, 1, windIntensity));
      const travel = windDirection
        .mul(forwardVelocity)
        .add(sideDirection.mul(sideVelocity))
        .mul(this.uniforms.uDelta)
        .mul(isAlive);
      const position = VegetationSsboUtils.wrapPosition(
        wrappedPosition.xz.add(travel),
        vec2(0),
        config.FIELD_SIZE,
      );
      const isOnGrass = step(0.001, data.y);
      const verticalVelocity = flow.g
        .mul(2)
        .sub(1)
        .mul(mix(0.35, 0.9, seed))
        .mul(this.uniforms.uSpeed)
        .mul(mix(0.45, 1.1, windIntensity));

      data.x = position.x;
      data.y = data.y
        .add(verticalVelocity.mul(this.uniforms.uDelta).mul(isAlive))
        .clamp(0.12, this.uniforms.uHeight.add(1))
        .mul(isOnGrass);
      data.z = position.z;
      data.w = age;

      If(step(lifetime, age), () => {
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
        const spawnPosition = windDirection
          .mul(spawnForward)
          .add(sideDirection.mul(spawnSide));
        const spawnWorldPosition = vec3(
          spawnPosition.x,
          0,
          spawnPosition.y,
        ).add(this.uniforms.uPlayerPosition);
        const terrainHeight =
          VegetationSsboUtils.computeYOffset(spawnWorldPosition);
        const spawnOnGrass =
          VegetationSsboUtils.computeGrassMask(spawnWorldPosition);
        const height = mix(0.25, this.uniforms.uHeight.mul(0.85), variation);

        data.assign(
          vec4(
            spawnPosition.x,
            terrainHeight.add(height).mul(spawnOnGrass),
            spawnPosition.y,
            variation.mul(config.RESPAWN_DELAY).negate(),
          ),
        );
      });
    })().compute(config.PARTICLE_COUNT, [config.WORKGROUP_SIZE]);
  }
}

export default class WindAmbianceParticles {
  private ssbo = new WindParticlesSsbo();
  private mesh: InstancedMesh;
  private isComputeInFlight = false;

  constructor() {
    this.mesh = this.createMesh();
    sceneManager.scene.add(this.mesh);
    this.registerPrewarmTask();
    eventsManager.on("engine-render-update", this.onEngineUpdate);
    this.debug();
  }

  private createMesh() {
    const mesh = new InstancedMesh(
      new CircleGeometry(0.5, 8),
      new WindParticleMaterial(this.ssbo, uniforms),
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
        await rendererManager.renderer.computeAsync(this.ssbo.computeUpdate);
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

  private async updateSsbo() {
    if (this.isComputeInFlight) return;

    this.isComputeInFlight = true;
    try {
      await rendererManager.renderer.computeAsync(this.ssbo.computeUpdate);
    } catch (error) {
      console.error("[WindAmbianceParticles] computeAsync failed:", error);
    } finally {
      this.isComputeInFlight = false;
    }
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
  constructor(ssbo: WindParticlesSsbo, uniforms: WindParticleUniforms) {
    super();

    this.precision = "lowp";
    this.transparent = false;
    this.depthWrite = true;
    this.forceSinglePass = true;

    const data = ssbo.computeBuffer.element(instanceIndex);
    const particleIndex = float(instanceIndex);
    const seed = hash(particleIndex);
    const variation = hash(particleIndex.add(2048));
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
    const particleSize = mix(smallSize, largeSize, step(0.66, seed));
    const gustVisibility = smoothstep(
      seed.mul(0.55),
      1,
      windManager.uIntensityDirectional,
    );
    const visibility = step(0, data.w)
      .mul(step(0.001, data.y))
      .mul(lifeFade)
      .mul(gustVisibility);

    this.positionNode = data.xyz;
    this.scaleNode = particleSize.mul(uniforms.uSize).mul(visibility);
    this.colorNode = uniforms.uColor.mul(mix(0.48, 0.72, variation));
  }
}
