import {
  float,
  hash,
  instanceIndex,
  mix,
  positionLocal,
  smoothstep,
  step,
  texture,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import {
  AddEquation,
  CustomBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  SpriteNodeMaterial,
} from "three/webgpu";
import { assets } from "../../../systems";
import { config } from "./CampfireFireConfig";
import type { CampfireFireCompute } from "./CampfireFireCompute";

const { SCALE, HEIGHT, BLOOM } = config;

export class CampfireFireMaterial extends SpriteNodeMaterial {
  constructor(compute: CampfireFireCompute) {
    super();
    this.transparent = true;
    this.depthWrite = false;
    this.blending = CustomBlending;
    this.blendEquation = AddEquation;
    this.blendSrc = OneFactor;
    this.blendDst = OneMinusSrcAlphaFactor;

    const particle = compute.particles.element(instanceIndex);
    const isSpark = compute.sparkFlags.element(instanceIndex);
    const firstRandom = hash(instanceIndex.add(9234));
    const secondRandom = hash(instanceIndex.add(33.87));

    this.positionNode = particle.xyz;

    const sparkScale = float(1).sub(isSpark.mul(0.85));
    const baseScale = secondRandom.clamp(0.25, 1);
    this.scaleNode = baseScale.mul(particle.w).mul(sparkScale).mul(SCALE);

    const spriteCorner = vec2(
      step(0.5, firstRandom).mul(0.5),
      step(0.5, secondRandom).mul(0.5),
    );
    const spriteUv = uv().mul(0.5).add(spriteCorner);
    const sprite = texture(assets.resources.fireSprites, spriteUv);

    const gold = vec3(0.72, 0.62, 0.08).mul(2).toConst();
    const deepRed = vec3(1, 0.1, 0).mul(4).toConst();
    const black = vec3(0).toConst();

    const effectiveHeight = mix(HEIGHT, HEIGHT * 2, isSpark);
    const heightRatio = positionLocal.y.div(effectiveHeight);
    const heightFactor = smoothstep(0, 1, heightRatio).pow(2);
    const lowerColor = mix(gold, deepRed, smoothstep(0, 0.25, heightFactor));
    const fireColor = mix(lowerColor, black, smoothstep(0.9, 1, heightFactor));
    // 0 -> additive, 1 -> normal
    const isNormalBlend = step(0.65, secondRandom);
    const lowFlame = float(1).sub(smoothstep(0, 0.85, heightFactor));
    const blendFactor = isNormalBlend.mul(lowFlame);
    const alphaScale = float(0.5).toConst();
    const alphaBlend = sprite.r.mul(blendFactor).mul(alphaScale);
    const particleColor = mix(fireColor, deepRed, isSpark);
    this.colorNode = particleColor.mul(alphaBlend).mul(BLOOM);
    this.alphaTest = 0.1;
    this.opacityNode = particle.w.mul(sprite.r).mul(alphaScale);
  }
}
