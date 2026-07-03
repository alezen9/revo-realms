import {
  abs,
  float,
  Fn,
  hash,
  instancedArray,
  instanceIndex,
  max,
  mix,
  PI2,
  sin,
  smoothstep,
  step,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  type ComputeNode,
  InstancedMesh,
  PlaneGeometry,
  SpriteNodeMaterial,
  Vector3,
} from "three/webgpu";
import { rendererManager, sceneManager, windManager } from "../../systems";
import { VegetationSsboUtils } from "../Vegetation/ssboUtils";
import type { WindAmbianceUniforms } from "./WindAmbiance";

const config = {
  PARTICLE_COUNT: 640,
  FIELD_SIZE: 140,
  FIELD_HALF_SIZE: 70,
  EDGE_FADE_SIZE: 12,
  PARTICLE_LIFETIME: 3.4,
  PARTICLE_SPEED: 21,
  WORKGROUP_SIZE: 64,
};

export default class WindAmbianceParticles {
  private buffer = instancedArray(config.PARTICLE_COUNT, "vec4");
  private mesh: InstancedMesh;
  private uniforms: WindAmbianceUniforms;
  private computeInit: ComputeNode;
  private computeUpdate: ComputeNode;

  constructor(uniforms: WindAmbianceUniforms) {
    this.uniforms = uniforms;
    this.computeInit = this.createComputeInit();
    this.computeUpdate = this.createComputeUpdate();
    this.mesh = this.createMesh();
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    sceneManager.scene.add(this.mesh);

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
  }

  syncPlayerPosition(playerPosition: Vector3) {
    this.mesh.position.copy(playerPosition);
  }

  setVisible(isVisible: boolean) {
    this.mesh.visible = isVisible;
  }

  update() {
    return rendererManager.renderer.computeAsync(this.computeUpdate);
  }

  private createMesh() {
    return new InstancedMesh(
      new PlaneGeometry(1, 1),
      this.createMaterial(),
      config.PARTICLE_COUNT,
    );
  }

  private createMaterial() {
    const material = new SpriteNodeMaterial();
    material.precision = "lowp";
    material.transparent = false;
    material.depthWrite = true;
    material.forceSinglePass = true;
    material.alphaTest = 0.18;

    const data = this.buffer.element(instanceIndex);
    const particleIndex = float(instanceIndex);
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
    const lifeProgress = data.w.div(config.PARTICLE_LIFETIME).clamp();
    const lifeFade = smoothstep(0, 0.18, lifeProgress).mul(
      float(1).sub(smoothstep(0.82, 1, lifeProgress)),
    );
    const centeredUv = uv().mul(2).sub(1);
    const radialDistanceSq = centeredUv.x.mul(centeredUv.x).add(
      centeredUv.y.mul(centeredUv.y),
    );
    const particleMask = float(1).sub(smoothstep(0.42, 1, radialDistanceSq));
    const particleSize = mix(
      0.045,
      0.18,
      hash(particleIndex.add(this.uniforms.uEventSeed.mul(6.1))),
    );
    const visibility = isAlive
      .mul(lifeFade)
      .mul(fieldFade)
      .mul(this.uniforms.uEffectFade);

    material.positionNode = vec3(data.x, data.y, data.z);
    material.scaleNode = particleSize.mul(visibility);
    material.colorNode = this.uniforms.uColor;
    material.opacityNode = particleMask.mul(visibility);

    return material;
  }

  private createComputeInit() {
    return Fn(() => {
      const data = this.buffer.element(instanceIndex);
      const particleIndex = float(instanceIndex);
      const windDirection = windManager.uDirection;
      const sideDirection = vec2(windDirection.y.negate(), windDirection.x);
      const forwardOffset = hash(particleIndex.add(11.13))
        .sub(0.5)
        .mul(config.FIELD_SIZE);
      const sideOffset = hash(particleIndex.add(23.19))
        .sub(0.5)
        .mul(config.FIELD_SIZE);
      const localXZ = windDirection
        .mul(forwardOffset)
        .add(sideDirection.mul(sideOffset));
      const worldPos = vec3(localXZ.x, 0, localXZ.y).add(
        this.uniforms.uPlayerPosition,
      );
      const grassScale = VegetationSsboUtils.computeGrassScale(worldPos);
      const yOffset = VegetationSsboUtils.computeYOffset(worldPos);
      const height = mix(
        0.25,
        this.uniforms.uHeight,
        hash(particleIndex.add(31.73)),
      );
      const age = hash(particleIndex.add(113.11)).mul(
        config.PARTICLE_LIFETIME,
      );

      data.assign(vec4(localXZ.x, yOffset.add(height).mul(grassScale), localXZ.y, age));
    })().compute(config.PARTICLE_COUNT, [config.WORKGROUP_SIZE]);
  }

  private createComputeUpdate() {
    return Fn(() => {
      const data = this.buffer.element(instanceIndex);
      const particleIndex = float(instanceIndex);
      const windDirection = windManager.uDirection;
      const sideDirection = vec2(windDirection.y.negate(), windDirection.x);
      const wrappedPosition = VegetationSsboUtils.wrapPosition(
        vec2(data.x, data.z),
        this.uniforms.uPlayerDeltaXZ,
        config.FIELD_SIZE,
      );
      const age = data.w.add(this.uniforms.uDelta.mul(this.uniforms.uSpeed));
      const particleSeed = hash(
        particleIndex
          .add(this.uniforms.uEventSeed.mul(41.19))
          .add(age.mul(5.37)),
      );
      const speedVariation = mix(0.55, 1.85, hash(particleSeed.add(4.31)));
      const windSpeed = config.PARTICLE_SPEED;
      const curlPhase = age
        .mul(mix(1.2, 2.8, hash(particleSeed.add(15.8))))
        .add(particleSeed.mul(PI2));
      const sideDrift = sin(curlPhase)
        .mul(mix(0.18, 0.9, hash(particleSeed.add(8.93))))
        .mul(this.uniforms.uDelta);
      const travel = windDirection
        .mul(windSpeed)
        .mul(this.uniforms.uSpeed)
        .mul(speedVariation)
        .mul(this.uniforms.uDelta)
        .add(sideDirection.mul(sideDrift));
      const nextXZ = wrappedPosition.xz.add(travel);
      const relativeForward = nextXZ.dot(windDirection);
      const relativeSide = nextXZ.dot(sideDirection);
      const outsideForward = step(config.FIELD_HALF_SIZE, abs(relativeForward));
      const outsideSide = step(config.FIELD_HALF_SIZE, abs(relativeSide));
      const expired = step(config.PARTICLE_LIFETIME, age);
      const shouldRespawn = max(
        max(max(expired, outsideForward), outsideSide),
        this.uniforms.uResetAll,
      );
      const spawnForward = mix(
        config.FIELD_HALF_SIZE * -0.82,
        config.FIELD_HALF_SIZE * 0.28,
        hash(particleSeed.add(13.13)),
      );
      const spawnSide = hash(particleSeed.add(19.71))
        .sub(0.5)
        .mul(config.FIELD_SIZE);
      const spawnXZ = windDirection
        .mul(spawnForward)
        .add(sideDirection.mul(spawnSide));
      const finalXZ = mix(nextXZ, spawnXZ, shouldRespawn);
      const worldPos = vec3(finalXZ.x, 0, finalXZ.y).add(
        this.uniforms.uPlayerPosition,
      );
      const grassScale = VegetationSsboUtils.computeGrassScale(worldPos);
      const yOffset = VegetationSsboUtils.computeYOffset(worldPos);
      const heightWave = sin(curlPhase.mul(0.73))
        .mul(this.uniforms.uHeight)
        .mul(0.06);
      const spawnHeight = mix(
        0.22,
        this.uniforms.uHeight,
        hash(particleSeed.add(29.37)),
      );
      const nextHeight = mix(data.y.add(heightWave.mul(this.uniforms.uDelta)), yOffset.add(spawnHeight), shouldRespawn);
      const resetAge = mix(
        float(0),
        hash(particleIndex.add(43.57)).mul(config.PARTICLE_LIFETIME * 0.82),
        this.uniforms.uResetAll,
      );

      data.x = finalXZ.x;
      data.y = nextHeight.mul(step(0.05, grassScale));
      data.z = finalXZ.y;
      data.w = mix(age, resetAge, shouldRespawn);
    })().compute(config.PARTICLE_COUNT, [config.WORKGROUP_SIZE]);
  }
}
