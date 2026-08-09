import {
  float,
  hash,
  instanceIndex,
  mix,
  smoothstep,
  uv,
  varying,
  vec3,
} from "three/tsl";
import { SpriteNodeMaterial } from "three/webgpu";
import { lightingManager } from "../../../systems";
import { uniforms } from "./config";
import { GrassCompute } from "./GrassCompute";

export class GrassMaterial extends SpriteNodeMaterial {
  private compute: GrassCompute;

  constructor(compute: GrassCompute) {
    super();

    this.compute = compute;
    this.createGrassMaterial();
  }

  private createGrassMaterial() {
    this.precision = "lowp";
    this.transparent = false;
    this.stencilWrite = false;
    this.forceSinglePass = true;

    const bladeIndex = this.compute.visibleIndexBuffer.element(instanceIndex);
    const bladeState = this.compute.bladeStateBuffer.element(bladeIndex);
    const bladeTerrain = this.compute.bladeTerrainBuffer.element(bladeIndex);

    const offsetX = bladeState.x;
    const offsetY = this.compute.getYOffset(bladeTerrain);
    const offsetZ = bladeState.y;

    const bendXZ = this.compute.getBend(bladeState);
    const scaleY = this.compute.getScale(bladeState);
    const isVisible = this.compute.getVisibility(bladeState);
    const positionNoise = this.compute.getPositionNoise(bladeTerrain);
    const bakedShadowFactor = this.compute.getBakedShadowFactor(bladeTerrain);

    // Common
    const bladeUv = uv();
    const h = bladeUv.y;
    const bend = h.mul(h);

    const bladeHash = hash(bladeIndex);
    const instanceNoise = bladeHash.mul(0.25).sub(0.125);
    const spriteNoise = bladeHash.mul(31.7).fract().mul(2).sub(1);

    // Visibility
    this.opacityNode = varying(isVisible);

    // Scale
    const scaleX = positionNoise.add(0.5);

    this.scaleNode = vec3(scaleX, scaleY, 1).mul(isVisible);

    // Rotation
    const spriteRotation = spriteNoise.mul(uniforms.uSpriteRotationRandomness);

    const bendProfile = bend.mul(uniforms.uBaseBending);

    const baseBending = positionNoise
      .sub(0.5)
      .mul(0.25)
      .add(instanceNoise)
      .mul(bendProfile);

    this.rotationNode = spriteRotation.add(baseBending);

    const bladePosition = vec3(offsetX, offsetY, offsetZ);
    const bendOffset = vec3(bendXZ.x, 0, bendXZ.y).mul(bend);
    this.positionNode = bladePosition.add(bendOffset);

    // AO
    const distanceSquared = offsetX.mul(offsetX).add(offsetZ.mul(offsetZ));

    const nearAo = float(1).sub(
      smoothstep(0, uniforms.uAoRadiusSquared, distanceSquared),
    );

    const aoStrength = varying(uniforms.uAoScale.mul(0.25).mul(nearAo));

    const edge = bladeUv.x.mul(2).sub(1).abs();

    const edgeMask = smoothstep(
      uniforms.uAoRimSmoothness.negate(),
      uniforms.uAoRimSmoothness,
      edge,
    );

    const rootMask = float(1).sub(smoothstep(0.1, 0.85, h));

    const ao = float(1).sub(aoStrength.mul(edgeMask).mul(rootMask));

    // Color variation
    const colorVariation = smoothstep(
      0,
      uniforms.uColorVariationStrength,
      positionNoise,
    );

    const bladeColor = varying(
      mix(uniforms.uBaseColorDark, uniforms.uBaseColor, colorVariation),
    );

    // Baked shadow
    const shadow = varying(
      mix(lightingManager.uBakedShadowBrightness, 1, bakedShadowFactor),
    );

    // Base -> tip
    const baseToTip = mix(
      bladeColor,
      uniforms.uTipColor,
      h.mul(uniforms.uColorMixFactor),
    );

    this.colorNode = baseToTip.mul(shadow.mul(ao));
  }
}
