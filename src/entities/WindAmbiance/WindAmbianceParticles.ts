import {
  abs,
  cos,
  float,
  floor,
  Fn,
  hash,
  If,
  instancedArray,
  instanceIndex,
  max,
  min,
  mix,
  PI2,
  sin,
  smoothstep,
  step,
  uv,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  type ComputeNode,
  InstancedMesh,
  PlaneGeometry,
  SpriteNodeMaterial,
  Vector2,
  Vector3,
} from "three/webgpu";
import { rendererManager, sceneManager, windManager } from "../../systems";
import { VegetationSsboUtils } from "../Vegetation/ssboUtils";

export const createWindParticleUniforms = () => ({
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),
  uPlayerPosition: uniform(new Vector3()),
  uDelta: uniform(0),
  uEffectFade: uniform(0),
  uResetAll: uniform(0),
  uEventSeed: uniform(0),
  uSpeed: uniform(0.58),
  uHeight: uniform(5.5),
});

type WindParticleUniforms = ReturnType<typeof createWindParticleUniforms>;

const getConfig = () => {
  const PARTICLES_PER_SIDE = 64;
  const FIELD_SIZE = 170;

  return {
    PARTICLES_PER_SIDE,
    PARTICLE_COUNT: PARTICLES_PER_SIDE * PARTICLES_PER_SIDE,
    FIELD_SIZE,
    FIELD_HALF_SIZE: FIELD_SIZE / 2,
    PARTICLE_SPACING: FIELD_SIZE / PARTICLES_PER_SIDE,
    EDGE_FADE_SIZE: 28,
    PARTICLE_LIFETIME: 4.2,
    PARTICLE_SPEED: 30,
    RESPAWN_DELAY: 2.1,
    WORKGROUP_SIZE: 64,
  };
};

const config = getConfig();

class WindParticleState {
  private buffer = instancedArray(config.PARTICLE_COUNT, "vec4");
  private uniforms: WindParticleUniforms;
  private computeInit: ComputeNode;
  private computeUpdate: ComputeNode;

  constructor(uniforms: WindParticleUniforms) {
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

  get updateNode() {
    return this.computeUpdate;
  }

  private createComputeInit() {
    return Fn(() => {
      const data = this.buffer.element(instanceIndex);
      const particleIndex = float(instanceIndex);
      const row = floor(particleIndex.div(config.PARTICLES_PER_SIDE));
      const col = particleIndex.sub(row.mul(config.PARTICLES_PER_SIDE));
      const windDirection = windManager.uDirection;
      const sideDirection = vec2(windDirection.y.negate(), windDirection.x);
      const forwardWarp = sin(
        col.mul(1.73).add(hash(particleIndex.add(41.37)).mul(PI2)),
      )
        .mul(config.PARTICLE_SPACING)
        .mul(2.4);
      const sideWarp = cos(
        row.mul(2.11).add(hash(particleIndex.add(59.91)).mul(PI2)),
      )
        .mul(config.PARTICLE_SPACING)
        .mul(2.8);
      const forwardOffset = row
        .add(hash(particleIndex.add(11.13)))
        .div(config.PARTICLES_PER_SIDE)
        .mul(config.FIELD_SIZE)
        .sub(config.FIELD_HALF_SIZE)
        .add(forwardWarp);
      const sideOffset = col
        .add(hash(particleIndex.add(23.19)))
        .div(config.PARTICLES_PER_SIDE)
        .mul(config.FIELD_SIZE)
        .sub(config.FIELD_HALF_SIZE)
        .add(sideWarp);
      const localXZ = windDirection
        .mul(forwardOffset)
        .add(sideDirection.mul(sideOffset));
      const worldPos = vec3(localXZ.x, 0, localXZ.y).add(
        this.uniforms.uPlayerPosition,
      );
      const grassScale = VegetationSsboUtils.computeGrassScale(worldPos);
      const yOffset = VegetationSsboUtils.computeYOffset(worldPos);
      const isOnGrass = step(0.05, grassScale);
      const height = mix(
        0.3,
        this.uniforms.uHeight.mul(0.9),
        hash(particleIndex.add(31.73)),
      );
      const age = hash(particleIndex.add(113.11))
        .mul(config.PARTICLE_LIFETIME + config.RESPAWN_DELAY)
        .sub(config.RESPAWN_DELAY);

      data.assign(
        vec4(localXZ.x, yOffset.add(height).mul(isOnGrass), localXZ.y, age),
      );
    })().compute(config.PARTICLE_COUNT, [config.WORKGROUP_SIZE]);
  }

  private createComputeUpdate() {
    return Fn(() => {
      const data = this.buffer.element(instanceIndex);
      const particleIndex = float(instanceIndex);
      const row = floor(particleIndex.div(config.PARTICLES_PER_SIDE));
      const col = particleIndex.sub(row.mul(config.PARTICLES_PER_SIDE));
      const windDirection = windManager.uDirection;
      const sideDirection = vec2(windDirection.y.negate(), windDirection.x);
      const wrappedPosition = VegetationSsboUtils.wrapPosition(
        vec2(data.x, data.z),
        this.uniforms.uPlayerDeltaXZ,
        config.FIELD_SIZE,
      );
      const previousAge = data.w;
      const age = previousAge.add(
        this.uniforms.uDelta.mul(this.uniforms.uSpeed),
      );
      const isAlive = step(0, age);
      const particleSeed = hash(
        particleIndex.add(this.uniforms.uEventSeed.mul(41.19)),
      );
      const lifetime = mix(
        config.PARTICLE_LIFETIME * 0.72,
        config.PARTICLE_LIFETIME * 1.38,
        hash(particleSeed.add(5.17)),
      );
      const forwardPulse = sin(
        age
          .mul(mix(1.4, 3.8, hash(particleSeed.add(17.47))))
          .add(particleSeed.mul(PI2)),
      )
        .mul(0.5)
        .add(0.5);
      const speedVariation = mix(0.78, 1.84, hash(particleSeed.add(7.31)));
      const forwardVelocity = float(config.PARTICLE_SPEED)
        .mul(this.uniforms.uSpeed)
        .mul(speedVariation)
        .mul(mix(0.76, 1.22, forwardPulse))
        .mul(mix(0.82, 1.18, windManager.uIntensity));
      const sidePhaseA = age
        .mul(mix(2.1, 5.8, hash(particleSeed.add(13.83))))
        .add(particleSeed.mul(PI2));
      const sidePhaseB = age
        .mul(mix(4.5, 9.2, hash(particleSeed.add(29.61))))
        .add(hash(particleSeed.add(33.27)).mul(PI2));
      const sidePhaseC = wrappedPosition.x
        .mul(0.37)
        .add(wrappedPosition.z.mul(0.23))
        .add(age.mul(mix(1.8, 4.8, hash(particleSeed.add(44.53)))))
        .add(hash(particleSeed.add(48.17)).mul(PI2));
      const sideVelocity = sin(sidePhaseA)
        .mul(mix(4.5, 15.0, hash(particleSeed.add(19.73))))
        .add(cos(sidePhaseB).mul(mix(2.5, 11.0, hash(particleSeed.add(37.91)))))
        .add(sin(sidePhaseC).mul(mix(3.5, 13.0, hash(particleSeed.add(52.73)))))
        .mul(this.uniforms.uSpeed);
      const travel = windDirection
        .mul(forwardVelocity)
        .add(sideDirection.mul(sideVelocity))
        .mul(this.uniforms.uDelta)
        .mul(isAlive);
      const nextXZ = wrappedPosition.xz.add(travel);
      const forwardDistance = nextXZ.dot(windDirection);
      const sideDistance = nextXZ.dot(sideDirection);
      const outsideForward = step(config.FIELD_HALF_SIZE, abs(forwardDistance));
      const outsideSide = step(config.FIELD_HALF_SIZE, abs(sideDistance));
      const expired = step(lifetime, age);
      const shouldRespawn = max(
        max(max(expired, outsideForward), outsideSide),
        this.uniforms.uResetAll,
      );

      data.x = nextXZ.x;
      data.z = nextXZ.y;
      data.w = age;

      If(shouldRespawn, () => {
        const respawnForwardJitter = hash(particleSeed.add(43.13));
        const respawnSideJitter = hash(particleSeed.add(53.71));
        const resetForwardJitter = hash(particleIndex.add(47.53));
        const resetSideJitter = hash(particleIndex.add(61.19));
        const respawnForward = row
          .add(respawnForwardJitter)
          .div(config.PARTICLES_PER_SIDE)
          .mul(config.FIELD_HALF_SIZE * 0.82)
          .sub(config.FIELD_HALF_SIZE * 1.04);
        const resetForward = row
          .add(resetForwardJitter)
          .div(config.PARTICLES_PER_SIDE)
          .mul(config.FIELD_SIZE)
          .sub(config.FIELD_HALF_SIZE);
        const respawnSide = col
          .add(respawnSideJitter)
          .div(config.PARTICLES_PER_SIDE)
          .mul(config.FIELD_SIZE)
          .sub(config.FIELD_HALF_SIZE);
        const resetSide = col
          .add(resetSideJitter)
          .div(config.PARTICLES_PER_SIDE)
          .mul(config.FIELD_SIZE)
          .sub(config.FIELD_HALF_SIZE);
        const laneWarp = sin(
          row.mul(1.87).add(col.mul(0.63)).add(particleSeed.mul(PI2)),
        )
          .mul(config.PARTICLE_SPACING)
          .mul(1.8);
        const finalSpawnForward = mix(
          respawnForward,
          resetForward,
          this.uniforms.uResetAll,
        );
        const finalSpawnSide = mix(
          respawnSide,
          resetSide,
          this.uniforms.uResetAll,
        ).add(laneWarp);
        const spawnXZ = windDirection
          .mul(finalSpawnForward)
          .add(sideDirection.mul(finalSpawnSide));
        const worldPos = vec3(spawnXZ.x, 0, spawnXZ.y).add(
          this.uniforms.uPlayerPosition,
        );
        const grassScale = VegetationSsboUtils.computeGrassScale(worldPos);
        const yOffset = VegetationSsboUtils.computeYOffset(worldPos);
        const isOnGrass = step(0.05, grassScale);
        const height = mix(
          0.3,
          this.uniforms.uHeight.mul(0.9),
          hash(particleSeed.add(67.37)),
        );
        const respawnAge = hash(particleSeed.add(71.91))
          .mul(config.RESPAWN_DELAY)
          .negate();
        const resetAge = hash(particleIndex.add(79.57))
          .mul(config.PARTICLE_LIFETIME + config.RESPAWN_DELAY)
          .sub(config.RESPAWN_DELAY);

        data.x = spawnXZ.x;
        data.y = yOffset.add(height).mul(isOnGrass);
        data.z = spawnXZ.y;
        data.w = mix(respawnAge, resetAge, this.uniforms.uResetAll);
      });
    })().compute(config.PARTICLE_COUNT, [config.WORKGROUP_SIZE]);
  }
}

class WindParticleMaterial extends SpriteNodeMaterial {
  constructor(state: WindParticleState, uniforms: WindParticleUniforms) {
    super();

    this.precision = "lowp";
    this.transparent = false;
    this.depthWrite = true;
    this.forceSinglePass = true;
    this.alphaTest = 0.34;

    const data = state.computeBuffer.element(instanceIndex);
    const particleIndex = float(instanceIndex);
    const particleSeed = hash(
      particleIndex.add(uniforms.uEventSeed.mul(41.19)),
    );
    const windDirection = windManager.uDirection;
    const sideDirection = vec2(windDirection.y.negate(), windDirection.x);
    const relativeXZ = data.xz;
    const forwardDistance = abs(relativeXZ.dot(windDirection));
    const sideDistance = abs(relativeXZ.dot(sideDirection));
    const fieldFade = float(1)
      .sub(
        smoothstep(
          config.FIELD_HALF_SIZE - config.EDGE_FADE_SIZE,
          config.FIELD_HALF_SIZE,
          max(forwardDistance, sideDistance),
        ),
      )
      .clamp();
    const isAlive = step(0, data.w);
    const isOnGrass = step(0.001, data.y);
    const lifetime = mix(
      config.PARTICLE_LIFETIME * 0.72,
      config.PARTICLE_LIFETIME * 1.38,
      hash(particleSeed.add(5.17)),
    );
    const lifeProgress = data.w.div(lifetime).clamp();
    const lifeFade = smoothstep(0, 0.16, lifeProgress).mul(
      float(1).sub(smoothstep(0.74, 1, lifeProgress)),
    );
    const verticalPhaseA = data.w
      .mul(mix(2.7, 6.2, hash(particleSeed.add(83.61))))
      .add(particleSeed.mul(PI2));
    const verticalPhaseB = data.w
      .mul(mix(5.6, 11.4, hash(particleSeed.add(89.27))))
      .add(hash(particleSeed.add(97.43)).mul(PI2));
    const verticalOffset = sin(verticalPhaseA)
      .mul(mix(0.18, 1.25, hash(particleSeed.add(101.39))))
      .add(
        cos(verticalPhaseB).mul(mix(0.1, 0.9, hash(particleSeed.add(109.7)))),
      )
      .add(
        sin(
          data.x
            .mul(0.21)
            .add(data.z.mul(0.34))
            .add(data.w.mul(mix(1.5, 3.9, hash(particleSeed.add(114.11))))),
        ).mul(mix(0.16, 0.95, hash(particleSeed.add(118.93)))),
      )
      .mul(isAlive);
    const verticalScatter = hash(particleSeed.add(121.71))
      .sub(0.5)
      .mul(uniforms.uHeight)
      .mul(0.6);
    const lowerY = data.y.sub(uniforms.uHeight.mul(0.18));
    const upperY = data.y.add(uniforms.uHeight.mul(0.86));
    const visibleY = min(
      max(data.y.add(verticalScatter).add(verticalOffset), lowerY),
      upperY,
    );
    const centeredUv = uv().mul(2).sub(1);
    const radialDistanceSq = centeredUv.x
      .mul(centeredUv.x)
      .add(centeredUv.y.mul(centeredUv.y));
    const edgeNoise = sin(centeredUv.x.mul(17.0).add(particleSeed.mul(PI2)))
      .add(
        cos(centeredUv.y.mul(19.0).add(hash(particleSeed.add(3.7)).mul(PI2))),
      )
      .mul(0.055);
    const particleMask = float(1).sub(
      smoothstep(0.52, 0.84, radialDistanceSq.add(edgeNoise)),
    );
    const sizeRandom = hash(particleSeed.add(127.31));
    const smallParticleSize = mix(0.012, 0.052, sizeRandom);
    const largeParticleSize = mix(0.06, 0.13, hash(particleSeed.add(129.43)));
    const particleSize = mix(
      smallParticleSize,
      largeParticleSize,
      step(0.72, sizeRandom),
    );
    const visibility = isAlive
      .mul(isOnGrass)
      .mul(lifeFade)
      .mul(fieldFade)
      .mul(uniforms.uEffectFade);
    const coolGrey = vec3(0.42, 0.42, 0.39);
    const lightGrey = vec3(0.68, 0.68, 0.63);

    this.positionNode = vec3(data.x, visibleY, data.z);
    this.scaleNode = particleSize.mul(visibility);
    this.colorNode = mix(coolGrey, lightGrey, hash(particleSeed.add(131.83)));
    this.opacityNode = particleMask.mul(isAlive).mul(isOnGrass);
  }
}

export default class WindAmbianceParticles {
  private state: WindParticleState;
  private mesh: InstancedMesh;

  constructor(uniforms: WindParticleUniforms) {
    this.state = new WindParticleState(uniforms);
    this.mesh = new InstancedMesh(
      new PlaneGeometry(1, 1),
      new WindParticleMaterial(this.state, uniforms),
      config.PARTICLE_COUNT,
    );
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    sceneManager.scene.add(this.mesh);
  }

  syncPlayerPosition(playerPosition: Vector3) {
    this.mesh.position.copy(playerPosition);
  }

  setVisible(isVisible: boolean) {
    this.mesh.visible = isVisible;
  }

  async preparePrewarmAsync() {
    this.mesh.visible = true;
    await this.update();
  }

  restorePrewarm() {
    this.mesh.visible = false;
  }

  update() {
    return rendererManager.renderer.computeAsync(this.state.updateNode);
  }
}
