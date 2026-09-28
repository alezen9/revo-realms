import { Color, Matrix4, NoBlending, Vector2, Vector3 } from "three";
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
  uniform,
  uv,
  vec3,
} from "three/tsl";
import { gameTime } from "../../systems/time/gameTime";
import { blendRNM } from "../../shaders/normals";
import { assets, lighting, debugPanel, graphics } from "../../systems";

export class WaterMaterial extends MeshBasicNodeMaterial {
  uniforms = {
    uUvScale: uniform(2.7),
    uNormalScale: uniform(0.05),
    uRefractionStrength: uniform(0.1),
    uFresnelScale: uniform(0.5),
    uSpeed: uniform(0.1),
    uNoiseScrollDir: uniform(new Vector2(0.1, 0)),
    uShininess: uniform(500),
    uMinDist: uniform(0),
    uMaxDist: uniform(0),
    uSunDir: uniform(lighting.sunDirection),
    uSunColor: uniform(lighting.sunColor.clone()),
    uTworld: uniform(new Vector3()),
    uBworld: uniform(new Vector3()),
    uNworld: uniform(new Vector3()),
    uHighlightsGlow: uniform(4),
    uHighlightFresnelInfluence: uniform(0.35),
    uDepthDistance: uniform(20),
    // red absorbs fastest, which pushes the water toward blue and green with depth
    uAbsorptionRGB: uniform(new Vector3(0.35, 0.1, 0.08)),
    uInscatterTint: uniform(new Color(0.0, 0.09, 0.09)),
    uInscatterStrength: uniform(0.85),
    uAbsorptionScale: uniform(15),
    uMinOpacity: uniform(0.5),
    uHighlightsSpread: uniform(0.35),
    uDepthOpacityScale: uniform(0.1),
    uHighlightsDepthOpacityScale: uniform(0.05),
  };
  constructor(surfaceMatrixWorld: Matrix4) {
    super();
    const { uTworld, uBworld, uNworld } = this.uniforms;
    uTworld.value.set(1, 0, 0).transformDirection(surfaceMatrixWorld);
    uBworld.value.set(0, 0, -1).transformDirection(surfaceMatrixWorld);
    uNworld.value.set(0, 1, 0).transformDirection(surfaceMatrixWorld);
    this.createMaterial();
    this.debug();
  }

  private debug() {
    const folder = debugPanel.panel.addFolder({
      title: "🌊 Water",
      expanded: false,
    });

    const waves = folder.addFolder({
      title: "Waves",
      expanded: true,
    });

    waves.addBinding(this.uniforms.uSpeed, "value", {
      label: "Speed",
    });
    waves.addBinding(this.uniforms.uNormalScale, "value", {
      label: "Normal scale",
    });
    waves.addBinding(this.uniforms.uUvScale, "value", {
      label: "UV scale",
    });

    const highlights = folder.addFolder({
      title: "Highlights",
      expanded: true,
    });

    highlights.addBinding(this.uniforms.uShininess, "value", {
      label: "Shininess",
    });
    highlights.addBinding(this.uniforms.uHighlightsGlow, "value", {
      label: "Glow",
    });
    highlights.addBinding(this.uniforms.uHighlightFresnelInfluence, "value", {
      label: "Fresnel influence",
    });
    highlights.addBinding(this.uniforms.uSunColor, "value", {
      label: "Sun color",
      view: "color",
      color: { type: "float" },
    });
    highlights.addBinding(this.uniforms.uHighlightsSpread, "value", {
      label: "Highlights spread",
    });
    highlights.addBinding(this.uniforms.uHighlightsDepthOpacityScale, "value", {
      label: "Shoreline opacity",
      step: 0.001,
    });

    const reflectionsAndRefraction = folder.addFolder({
      title: "Reflections / Refraction",
      expanded: true,
    });
    reflectionsAndRefraction.addBinding(
      this.uniforms.uRefractionStrength,
      "value",
      {
        label: "Refraction strength",
      },
    );
    reflectionsAndRefraction.addBinding(this.uniforms.uFresnelScale, "value", {
      label: "Fresnel scale",
    });

    const beerLambert = folder.addFolder({
      title: "Beer-Lambert",
      expanded: true,
    });
    beerLambert.addBinding(this.uniforms.uInscatterStrength, "value", {
      label: "Inscatter strength",
    });
    beerLambert.addBinding(this.uniforms.uInscatterTint, "value", {
      label: "Inscatter tint",
      view: "color",
      color: { type: "float" },
    });
    beerLambert.addBinding(this.uniforms.uAbsorptionRGB, "value", {
      label: "Absorption coeff",
    });
    beerLambert.addBinding(this.uniforms.uAbsorptionScale, "value", {
      label: "Absorption scale",
    });

    const general = folder.addFolder({
      title: "General",
      expanded: true,
    });
    general.addBinding(this.uniforms.uMinOpacity, "value", {
      label: "Min opacity",
    });
    general.addBinding(this.uniforms.uMinDist, "value", {
      label: "Min opacity distance",
    });
    general.addBinding(this.uniforms.uMaxDist, "value", {
      label: "Max opacity distance",
    });
    general.addBinding(this.uniforms.uDepthDistance, "value", {
      label: "Depth distance",
    });
    general.addBinding(this.uniforms.uDepthOpacityScale, "value", {
      label: "Depth opacity scale",
    });
  }

  private createMaterial() {
    this.transparent = true;
    this.blending = NoBlending;

    const speed = gameTime.mul(this.uniforms.uSpeed);
    const frequency = this.uniforms.uNoiseScrollDir.mul(speed);
    const nUV1 = uv()
      .add(frequency)
      .mul(this.uniforms.uUvScale.mul(1.37))
      .fract();
    const tex1 = texture(assets.resources.normVeinWater, nUV1);
    const tsn1 = tex1.rgb.mul(2).sub(1).normalize();
    const nUV2 = uv()
      .sub(frequency)
      .mul(this.uniforms.uUvScale.mul(0.73))
      .fract();
    const tex2 = texture(assets.resources.normVeinWater, nUV2);
    const tsn2 = tex2.rgb.mul(2).sub(1).normalize();
    const blendedTsn = blendRNM(tsn1, tsn2);
    const tsn = vec3(
      blendedTsn.xy.mul(this.uniforms.uNormalScale),
      blendedTsn.z,
    ).normalize();
    const normal = tsn.x
      .mul(this.uniforms.uTworld)
      .add(tsn.y.mul(this.uniforms.uBworld))
      .add(tsn.z.mul(this.uniforms.uNworld))
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
    const waterDepth = fragmentDepth.div(this.uniforms.uDepthDistance).clamp();

    const distortionStrength = mix(
      this.uniforms.uRefractionStrength,
      this.uniforms.uRefractionStrength.mul(1.5),
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
      .div(this.uniforms.uDepthDistance)
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
    const fresnelSchlick = F0.add(float(1).sub(F0).mul(grazingAnglePow5));
    const fresnelWeight = fresnelSchlick
      .mul(this.uniforms.uFresnelScale)
      .clamp();

    const sigma = this.uniforms.uAbsorptionRGB.mul(
      this.uniforms.uAbsorptionScale,
    );
    const waterThickness = mix(waterDepth, waterDepthRefr, isSafe);
    const transmittance = exp(sigma.negate().mul(waterThickness));
    const tintColor = this.uniforms.uInscatterTint.mul(
      this.uniforms.uInscatterStrength,
    );
    const throughWater = tintColor
      .mul(float(1).sub(transmittance))
      .add(screenColor.mul(transmittance));

    const tsnHighlights = vec3(
      blendedTsn.xy.mul(this.uniforms.uHighlightsSpread),
      blendedTsn.z,
    ).normalize();
    const normalHighlights = tsnHighlights.x
      .mul(this.uniforms.uTworld)
      .add(tsnHighlights.y.mul(this.uniforms.uBworld))
      .add(tsnHighlights.z.mul(this.uniforms.uNworld))
      .normalize();
    const reflectedLight = reflect(this.uniforms.uSunDir, normalHighlights);
    const align = max(dot(reflectedLight, viewDir), 0);
    const spec = pow(align, this.uniforms.uShininess);
    const fresnelSpecBoost = mix(
      1,
      fresnelSchlick,
      this.uniforms.uHighlightFresnelInfluence,
    );
    const highlightsDepthOpacity = smoothstep(
      0,
      this.uniforms.uHighlightsDepthOpacityScale,
      waterThickness,
    );
    const sunGlint = spec
      .mul(this.uniforms.uHighlightsGlow)
      .mul(fresnelSpecBoost)
      .mul(highlightsDepthOpacity);

    const distanceXZSquared = dot(
      positionWorld.xz.sub(cameraPosition.xz),
      positionWorld.xz.sub(cameraPosition.xz),
    );

    const min2 = this.uniforms.uMinDist.mul(this.uniforms.uMinDist);
    const max2 = this.uniforms.uMaxDist.mul(this.uniforms.uMaxDist);

    const distOpacity = smoothstep(min2, max2, distanceXZSquared)
      .add(this.uniforms.uMinOpacity)
      .clamp();

    const depthOpacity = smoothstep(
      0,
      this.uniforms.uDepthOpacityScale,
      waterThickness,
    );

    const opacity = distOpacity.mul(depthOpacity).clamp();

    const shadedWater = mix(throughWater, reflectedColor, fresnelWeight);
    const color = mix(screenColor, shadedWater, opacity);
    this.colorNode = mix(color, this.uniforms.uSunColor, sunGlint);
    this.opacityNode = isUnderWater;
  }
}
