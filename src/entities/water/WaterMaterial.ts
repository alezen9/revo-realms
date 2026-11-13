import { Matrix4, NoBlending } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  cameraFar,
  cameraNear,
  cameraPosition,
  cubeTexture,
  dot,
  exp,
  float,
  max,
  mix,
  normalize,
  perspectiveDepthToViewZ,
  positionView,
  positionWorld,
  pow,
  reflect,
  screenUV,
  smoothstep,
  step,
  texture,
  uv,
  vec3,
} from "three/tsl";
import { gameTime } from "../../systems/time/gameTime";
import { blendRNM } from "../../shaders/normals";
import { assets, graphics } from "../../systems";
import { uniforms } from "./WaterConfig";

export class WaterMaterial extends MeshBasicNodeMaterial {
  constructor(surfaceMatrixWorld: Matrix4) {
    super();
    const { uTworld, uBworld, uNworld } = uniforms;
    uTworld.value.set(1, 0, 0).transformDirection(surfaceMatrixWorld);
    uBworld.value.set(0, 0, -1).transformDirection(surfaceMatrixWorld);
    uNworld.value.set(0, 1, 0).transformDirection(surfaceMatrixWorld);
    this.createMaterial();
  }

  private createMaterial() {
    this.transparent = true;
    this.blending = NoBlending;

    const speed = gameTime.mul(uniforms.uSpeed);
    const frequency = uniforms.uNoiseScrollDir.mul(speed);
    const nUV1 = uv().add(frequency).mul(uniforms.uUvScale.mul(1.37)).fract();
    const tex1 = texture(assets.resources.normVeinWater, nUV1);
    const tsn1 = tex1.rgb.mul(2).sub(1).normalize();
    const nUV2 = uv().sub(frequency).mul(uniforms.uUvScale.mul(0.73)).fract();
    const tex2 = texture(assets.resources.normVeinWater, nUV2);
    const tsn2 = tex2.rgb.mul(2).sub(1).normalize();
    const blendedTsn = blendRNM(tsn1, tsn2);
    const tsn = vec3(
      blendedTsn.xy.mul(uniforms.uNormalScale),
      blendedTsn.z,
    ).normalize();
    const normal = tsn.x
      .mul(uniforms.uTworld)
      .add(tsn.y.mul(uniforms.uBworld))
      .add(tsn.z.mul(uniforms.uNworld))
      .normalize();

    const mainSceneDepth = graphics.mainSceneDepthNode;
    const zNdc = mainSceneDepth.sample(screenUV).r;
    const zLinear = perspectiveDepthToViewZ(
      zNdc,
      cameraNear,
      cameraFar,
    ).negate();
    const fragLinear = positionView.z.negate();
    const isUnderWater = step(fragLinear, zLinear);
    const fragmentDepth = zLinear.sub(fragLinear);
    const waterDepth = fragmentDepth.div(uniforms.uDepthDistance).clamp();

    const distortionStrength = mix(
      uniforms.uRefractionStrength,
      uniforms.uRefractionStrength.mul(1.5),
      waterDepth,
    );
    // tangent tilt, not the outward normal, drives the wobble
    const distortion = tsn.xy.mul(distortionStrength);
    const refractedScreenUv = screenUV.add(distortion.mul(isUnderWater));
    const zNdcRefr = mainSceneDepth.sample(refractedScreenUv).r;
    const zLinearRefr = perspectiveDepthToViewZ(
      zNdcRefr,
      cameraNear,
      cameraFar,
    ).negate();
    const isSafe = step(fragLinear, zLinearRefr);
    const fragmentDepthRefr = zLinearRefr.sub(fragLinear);
    const waterDepthRefr = fragmentDepthRefr
      .div(uniforms.uDepthDistance)
      .clamp();
    const safeScreenUv = mix(screenUV, refractedScreenUv, isSafe).clamp();
    const screenColor = graphics.sampleMainSceneColor(safeScreenUv).rgb;

    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const reflectVector = reflect(viewDir.negate(), normal);
    const reflectedColor = cubeTexture(
      assets.resources.envMapTexture,
      reflectVector,
    );

    // schlick fresnel: F0 + (1 - F0) * (1 - cos theta)^5, water reflects 2% head on
    const cosTheta = dot(normal, viewDir).clamp();
    const F0 = float(0.02);
    const grazingAngle = float(1.0).sub(cosTheta);
    // multiplying is much cheaper than pow
    const grazingAnglePow5 = grazingAngle
      .mul(grazingAngle)
      .mul(grazingAngle)
      .mul(grazingAngle)
      .mul(grazingAngle);
    const reflectanceRange = float(1).sub(F0);
    const fresnelSchlick = F0.add(reflectanceRange.mul(grazingAnglePow5));
    const fresnelWeight = fresnelSchlick.mul(uniforms.uFresnelScale).clamp();

    const sigma = uniforms.uAbsorptionRGB.mul(uniforms.uAbsorptionScale);
    const waterThickness = mix(waterDepth, waterDepthRefr, isSafe);
    const transmittance = exp(sigma.negate().mul(waterThickness));
    const tintColor = uniforms.uInscatterTint.mul(uniforms.uInscatterStrength);
    const throughWater = mix(tintColor, screenColor, transmittance);

    const tsnHighlights = vec3(
      blendedTsn.xy.mul(uniforms.uHighlightsSpread),
      blendedTsn.z,
    ).normalize();
    const normalHighlights = tsnHighlights.x
      .mul(uniforms.uTworld)
      .add(tsnHighlights.y.mul(uniforms.uBworld))
      .add(tsnHighlights.z.mul(uniforms.uNworld))
      .normalize();
    const reflectedLight = reflect(uniforms.uSunDir, normalHighlights);
    const align = max(dot(reflectedLight, viewDir), 0);
    const spec = pow(align, uniforms.uShininess);
    const fresnelSpecBoost = mix(
      1,
      fresnelSchlick,
      uniforms.uHighlightFresnelInfluence,
    );
    const highlightsDepthOpacity = smoothstep(
      0,
      uniforms.uHighlightsDepthOpacityScale,
      waterThickness,
    );
    const sunGlint = spec
      .mul(uniforms.uHighlightsGlow)
      .mul(fresnelSpecBoost)
      .mul(highlightsDepthOpacity);

    const distanceXZSquared = dot(
      positionWorld.xz.sub(cameraPosition.xz),
      positionWorld.xz.sub(cameraPosition.xz),
    );

    const min2 = uniforms.uMinDist.mul(uniforms.uMinDist);
    const max2 = uniforms.uMaxDist.mul(uniforms.uMaxDist);

    const distOpacity = smoothstep(min2, max2, distanceXZSquared)
      .add(uniforms.uMinOpacity)
      .clamp();

    const depthOpacity = smoothstep(
      0,
      uniforms.uDepthOpacityScale,
      waterThickness,
    );

    const opacity = distOpacity.mul(depthOpacity).clamp();

    const shadedWater = mix(throughWater, reflectedColor, fresnelWeight);
    const color = mix(screenColor, shadedWater, opacity);
    this.colorNode = mix(color, uniforms.uSunColor, sunGlint);
    this.opacityNode = isUnderWater;
  }
}
