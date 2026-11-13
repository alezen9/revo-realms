import { float, hash, instanceIndex, mix, smoothstep, step } from "three/tsl";
import { SpriteNodeMaterial } from "three/webgpu";
import { wind } from "../../systems";
import { config, uniforms } from "./WindParticlesConfig";
import type { WindParticlesCompute } from "./WindParticlesCompute";

export class WindParticlesMaterial extends SpriteNodeMaterial {
  constructor(particlesCompute: WindParticlesCompute) {
    super();

    this.transparent = false;
    this.depthWrite = true;
    this.forceSinglePass = true;

    const data = particlesCompute.particles.element(instanceIndex);
    const particleIndex = float(instanceIndex);
    const seed = hash(particleIndex);
    const variation = hash(particleIndex.add(config.VARIATION_SEED_OFFSET));
    const lifetime = mix(
      config.PARTICLE_LIFETIME * 0.82,
      config.PARTICLE_LIFETIME * 1.18,
      variation,
    );
    const lifeProgress = data.w.div(lifetime).clamp();
    const lifeFadeIn = smoothstep(0, 0.14, lifeProgress);
    const lifeFadeOut = float(1).sub(smoothstep(0.78, 1, lifeProgress));
    const lifeFade = lifeFadeIn.mul(lifeFadeOut);
    const smallSize = mix(0.03, 0.076, seed);
    const largeSize = mix(0.09, 0.18, variation);
    const isLargeParticle = step(0.66, seed);
    const particleSize = mix(smallSize, largeSize, isLargeParticle);
    const gustVisibility = smoothstep(
      seed.mul(0.55),
      1,
      wind.uIntensityDirectional,
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
