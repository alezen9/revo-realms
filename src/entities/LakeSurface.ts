import { Color, Mesh, Vector2, Vector3 } from "three";
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
  viewportDepthTexture,
  viewportTexture,
} from "three/tsl";
import { gameTime } from "../utils/GameTime";
import { TSLUtils } from "../utils/TSLUtils";
import {
  assetManager,
  audioManager,
  lightingManager,
  debugManager,
  sceneManager,
  eventsManager,
  landmarkManager,
  windManager,
} from "../systems";

export class LakeSurface {
  constructor() {
    const lakeSurface = assetManager.resources.worldModel.scene.getObjectByName(
      "lake-surface",
    ) as Mesh;

    const uniforms = {
      uTworld: uniform(new Vector3(1, 0, 0)),
      uBworld: uniform(new Vector3(0, 0, -1)),
      uNworld: uniform(new Vector3(0, 1, 0)),
    };

    lakeSurface.material = new WaterMaterial(uniforms);
    lakeSurface.renderOrder = 100;
    uniforms.uTworld.value
      .transformDirection(lakeSurface.matrixWorld)
      .normalize();
    uniforms.uBworld.value
      .transformDirection(lakeSurface.matrixWorld)
      .normalize();
    uniforms.uNworld.value
      .transformDirection(lakeSurface.matrixWorld)
      .normalize();

    const geom = lakeSurface.geometry;
    const bsLocal = geom.boundingSphere!;
    bsLocal.radius = bsLocal.radius * 0.75;

    sceneManager.scene.add(lakeSurface);

    // Register landmark for radial menu discovery
    const landmarkId = landmarkManager.register({
      name: "Lake",
      icon: "water",
      position: lakeSurface.position,
      discoveryRadius: 150,
      arrivalRadius: 90,
    });

    // Register wind target and link to landmark
    const windTargetId = windManager.registerTarget(
      "Lake",
      lakeSurface.position,
      90,
    );
    landmarkManager.setWindTargetId(landmarkId, windTargetId);

    eventsManager.on("engine-loading-audio-progress", (p) => {
      if (p === 100) lakeSurface.add(audioManager.lake);
    });
  }
}

class WaterMaterial extends MeshBasicNodeMaterial {
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
    uSunDir: uniform(lightingManager.sunDirection),
    uSunColor: uniform(lightingManager.sunColor.clone()),
    uTworld: uniform(new Vector3(1, 0, 0)),
    uBworld: uniform(new Vector3(0, 0, -1)),
    uNworld: uniform(new Vector3(0, 1, 0)),
    uHighlightsGlow: uniform(4),
    uHighlightFresnelInfluence: uniform(0.35),
    uDepthDistance: uniform(20),
    uAbsorptionRGB: uniform(new Vector3(0.35, 0.1, 0.08)), // absorption coeff per channel, red absorbs fastest -> pushes toward blue/green with depth
    uInscatterTint: uniform(new Color(0.0, 0.09, 0.09)),
    uInscatterStrength: uniform(0.85),
    uAbsorptionScale: uniform(15),
    uMinOpacity: uniform(0.5),
    uHighlightsSpread: uniform(0.35),
    uDepthOpacityScale: uniform(0.1),
    uHighlightsDepthOpacityScale: uniform(0.05),
  };
  constructor(_uniforms = {}) {
    super();
    this.uniforms = { ...this.uniforms, ..._uniforms };
    this.createMaterial();
    this.debug();
  }

  private debug() {
    const folder = debugManager.panel.addFolder({
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
    this.precision = "lowp";
    this.fog = false;

    // 0. normal
    const speed = gameTime.mul(this.uniforms.uSpeed);
    const frequency = this.uniforms.uNoiseScrollDir.mul(speed);
    const nUV1 = uv()
      .add(frequency)
      .mul(this.uniforms.uUvScale.mul(1.37))
      .fract();
    const tex1 = texture(assetManager.resources.normVeinWater, nUV1);
    const tsn1 = tex1.rgb.mul(2).sub(1).normalize();
    const nUV2 = uv()
      .sub(frequency)
      .mul(this.uniforms.uUvScale.mul(0.73))
      .fract();
    const tex2 = texture(assetManager.resources.normVeinWater, nUV2);
    const tsn2 = tex2.rgb.mul(2).sub(1).normalize();
    const blendedTsn = TSLUtils.blendRNM(tsn1, tsn2);
    const tsn = vec3(
      blendedTsn.xy.mul(this.uniforms.uNormalScale),
      blendedTsn.z,
    ).normalize();
    const normal = tsn.x
      .mul(this.uniforms.uTworld)
      .add(tsn.y.mul(this.uniforms.uBworld))
      .add(tsn.z.mul(this.uniforms.uNworld))
      .normalize();

    // 1. depth
    const zNdc = viewportDepthTexture(screenUV).r;
    const zLinear = perspectiveDepthToViewZ(
      zNdc,
      cameraNear,
      cameraFar,
    ).negate();
    const fragLinear = positionView.z.negate();
    const isUnderWater = step(fragLinear, zLinear);
    const fragmentDepth = zLinear.sub(fragLinear);
    const waterDepth = fragmentDepth.div(this.uniforms.uDepthDistance).clamp();

    // 2. refraction
    const distortionStrength = mix(
      this.uniforms.uRefractionStrength,
      this.uniforms.uRefractionStrength.mul(1.5),
      waterDepth,
    );
    const distortion = tsn.xy.mul(distortionStrength); // tangent tilt, not outward, drives wobble
    const refractedScreenUv = screenUV.add(distortion.mul(isUnderWater));
    const zNdcRefr = viewportDepthTexture(refractedScreenUv).r;
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
    const screenColor = viewportTexture(safeScreenUv).rgb;

    // 3. reflections
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const reflectVector = reflect(viewDir.negate(), normal);
    const reflectedColor = cubeTexture(
      assetManager.resources.envMapTexture,
      reflectVector,
    );

    // 4. fresnel - Schlick's Fresnel approx F0 + (1 - F0) (1 - cos(theta))^5
    const cosTheta = dot(normal, viewDir).clamp(); // view angle factor [0..1]
    const F0 = float(0.02); // base reflectivity at head-on view (2% for water)
    const grazingAngle = float(1.0).sub(cosTheta);
    // much cheaper than pow
    const grazingAnglePow5 = grazingAngle
      .mul(grazingAngle)
      .mul(grazingAngle)
      .mul(grazingAngle)
      .mul(grazingAngle);
    const fresnelSchlick = F0.add(float(1).sub(F0).mul(grazingAnglePow5));
    const fresnelWeight = fresnelSchlick
      .mul(this.uniforms.uFresnelScale)
      .clamp();

    // 5. beer-lambert
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

    // 6. surface highlights
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
    const sunGlint = this.uniforms.uSunColor
      .mul(spec.mul(this.uniforms.uHighlightsGlow).mul(fresnelSpecBoost))
      .mul(highlightsDepthOpacity);

    // 7. opacity
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

    // 8. final color
    const shadedWater = mix(throughWater, reflectedColor, fresnelWeight);
    const color = mix(screenColor, shadedWater, opacity);
    this.colorNode = color.add(sunGlint);
    // this.colorNode = mix(
    //   color,
    //   vec3(0.5, 0.75, 0.5),
    //   smoothstep(0, 10, tex1.a.add(tex2.a)),
    // ).add(sunGlint);
  }
}
