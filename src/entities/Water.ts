import { Color, Mesh, Vector2, Vector3 } from "three";
import { sceneManager } from "../systems/SceneManager";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import {
  cameraPosition,
  cameraProjectionMatrix,
  cubeTexture,
  dot,
  exp,
  float,
  Fn,
  max,
  mix,
  normalize,
  positionView,
  positionWorld,
  pow,
  reflect,
  screenUV,
  smoothstep,
  step,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  viewportDepthTexture,
  viewportTexture,
} from "three/tsl";
import { eventsManager } from "../systems/EventsManager";
import { debugManager } from "../systems/DebugManager";
import { audioManager } from "../systems/AudioManager";
import { lighting } from "../systems/LightingSystem";
import { tslUtils } from "../utils/TSLUtils";

const uniforms = {
  uUvScale: uniform(2.7),
  uNormalScale: uniform(0.5),
  uRefractionStrength: uniform(0.01),
  uFresnelScale: uniform(0.075),
  uSpeed: uniform(0.1),
  uNoiseScrollDir: uniform(new Vector2(0.1, 0)),
  uShininess: uniform(300),
  uMinDist: uniform(1),
  uMaxDist: uniform(15),
  uSunDir: uniform(lighting.sunDirection),
  uSunColor: uniform(lighting.sunColor.clone()),
  uTworld: uniform(new Vector3(1, 0, 0)),
  uBworld: uniform(new Vector3(0, 0, -1)),
  uNworld: uniform(new Vector3(0, 1, 0)),
  uHighlightsGlow: uniform(4),
  uHighlightFresnelInfluence: uniform(0.35),
  uDepthDistance: uniform(20),
  uAbsorptionRGB: uniform(new Vector3(0.35, 0.1, 0.08)), // absorption coeff per channel, red absorbs fastest -> pushes toward blue/green with depth
  uInscatterTint: uniform(new Color(0.0, 0.09, 0.09)),
  uInscatterStrength: uniform(0.85),
  uAbsorptionScale: uniform(10),
  uMinOpacity: uniform(0.5),
};

export default class Water {
  constructor() {
    const water = assetManager.realmModel.scene.getObjectByName(
      "water",
    ) as Mesh;
    water.material = new WaterMaterial();
    water.renderOrder = 100;
    uniforms.uTworld.value.transformDirection(water.matrixWorld).normalize();
    uniforms.uBworld.value.transformDirection(water.matrixWorld).normalize();
    uniforms.uNworld.value.transformDirection(water.matrixWorld).normalize();

    const geom = water.geometry;
    const bsLocal = geom.boundingSphere!;
    bsLocal.radius = bsLocal.radius * 0.75;

    sceneManager.scene.add(water);

    eventsManager.on("audio-ready", () => {
      water.add(audioManager.lake);
    });
  }
}

class WaterMaterial extends MeshBasicNodeMaterial {
  constructor() {
    super();
    this.createMaterial();
    this.debugWater();
  }

  private debugWater() {
    const folder = debugManager.panel.addFolder({
      title: "🌊 Water",
      expanded: true,
    });

    const waves = folder.addFolder({
      title: "Waves",
      expanded: true,
    });

    waves.addBinding(uniforms.uSpeed, "value", {
      label: "Speed",
    });
    waves.addBinding(uniforms.uNormalScale, "value", {
      label: "Normal scale",
    });
    waves.addBinding(uniforms.uUvScale, "value", {
      label: "UV scale",
    });

    const highlights = folder.addFolder({
      title: "Highlights",
      expanded: true,
    });

    highlights.addBinding(uniforms.uShininess, "value", {
      label: "Shininess",
    });
    highlights.addBinding(uniforms.uHighlightsGlow, "value", {
      label: "Glow",
    });
    highlights.addBinding(uniforms.uHighlightFresnelInfluence, "value", {
      label: "Fresnel influence",
    });
    highlights.addBinding(uniforms.uSunColor, "value", {
      label: "Sun color",
      view: "color",
      color: { type: "float" },
    });

    const reflectionsAndRefraction = folder.addFolder({
      title: "Reflections / Refraction",
      expanded: true,
    });
    reflectionsAndRefraction.addBinding(uniforms.uRefractionStrength, "value", {
      label: "Refraction strength",
    });
    reflectionsAndRefraction.addBinding(uniforms.uFresnelScale, "value", {
      label: "Fresnel scale",
    });

    const beerLambert = folder.addFolder({
      title: "Beer-Lambert",
      expanded: true,
    });
    beerLambert.addBinding(uniforms.uInscatterStrength, "value", {
      label: "Inscatter strength",
    });
    beerLambert.addBinding(uniforms.uInscatterTint, "value", {
      label: "Inscatter tint",
      view: "color",
      color: { type: "float" },
    });
    beerLambert.addBinding(uniforms.uAbsorptionRGB, "value", {
      label: "Absorption coeff",
    });
    beerLambert.addBinding(uniforms.uAbsorptionScale, "value", {
      label: "Absorption scale",
    });

    const general = folder.addFolder({
      title: "General",
      expanded: true,
    });
    general.addBinding(uniforms.uMinOpacity, "value", {
      label: "Min opacity",
    });
    general.addBinding(uniforms.uMinDist, "value", {
      label: "Min opacity distance",
    });
    general.addBinding(uniforms.uMaxDist, "value", {
      label: "Max opacity distance",
    });
    general.addBinding(uniforms.uDepthDistance, "value", {
      label: "Depth distance",
    });
  }

  private sampleNormal = Fn(([uv = vec2(0)]) => {
    const tex = texture(assetManager.waterNormal, uv);
    return tex.mul(2).sub(1).rgb.normalize();
  });

  private createMaterial() {
    this.precision = "lowp";

    // 0. normal
    const speed = time.mul(uniforms.uSpeed);
    const frequency = uniforms.uNoiseScrollDir.mul(speed);
    const nUV1 = uv().add(frequency).mul(uniforms.uUvScale.mul(1.37)).fract();
    const tsn1 = this.sampleNormal(nUV1);
    const nUV2 = uv().sub(frequency).mul(uniforms.uUvScale.mul(0.73)).fract();
    const tsn2 = this.sampleNormal(nUV2);
    const blendedTsn = tslUtils.blendRNM(tsn1, tsn2);
    const tsn = vec3(
      blendedTsn.xy.mul(uniforms.uNormalScale),
      blendedTsn.z,
    ).normalize();
    const normal = tsn.x
      .mul(uniforms.uTworld)
      .add(tsn.y.mul(uniforms.uBworld))
      .add(tsn.z.mul(uniforms.uNworld))
      .normalize();

    // 1. depth
    const sceneDepth = viewportDepthTexture(screenUV).r;
    const p3z = cameraProjectionMatrix.element(3).element(2);
    const p2z = cameraProjectionMatrix.element(2).element(2);
    const sceneLinear = p3z.div(sceneDepth.add(p2z));
    const fragLinear = positionView.z.negate();
    const isUnderWater = step(fragLinear, sceneLinear);
    const fragmentDepth = sceneLinear.sub(fragLinear);
    const waterDepth = fragmentDepth.div(uniforms.uDepthDistance).clamp();

    // 2. refracted UV
    const distortionStrength = mix(
      uniforms.uRefractionStrength,
      uniforms.uRefractionStrength.mul(1.5),
      waterDepth,
    );
    const distortion = tsn.xy.mul(distortionStrength); // NOTE: xy not xz because tangent space
    const refractedScreenUv = screenUV.add(distortion.mul(isUnderWater));

    // 3. refracted depth
    const depthRefr = viewportDepthTexture(refractedScreenUv).r;
    const sceneLinearRefr = p3z.div(depthRefr.add(p2z));
    const isSafe = step(fragLinear, sceneLinearRefr);
    const fragmentDepthRefr = sceneLinearRefr.sub(fragLinear);
    const waterDepthRefr = fragmentDepthRefr
      .div(uniforms.uDepthDistance)
      .clamp();

    // 4. reflection and fresnel
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const reflectVector = reflect(viewDir.negate(), normal);
    const reflectedColor = cubeTexture(
      assetManager.envMapTexture,
      reflectVector,
    );

    // Schlick's Fresnel approx F0 + (1 - F0) (1 - cos(theta))^5
    const cosTheta = dot(normal, viewDir).clamp(); // view angle factor [0..1]
    const F0 = float(0.02); // base reflectivity at head-on view (2% for water)
    const grazingAngle = float(1.0).sub(cosTheta);
    // much cheaper than pow
    const grazingAnglePow5 = grazingAngle
      .mul(grazingAngle)
      .mul(grazingAngle)
      .mul(grazingAngle)
      .mul(grazingAngle);
    const fresnelSchlick = F0.add(float(1.0).sub(F0).mul(grazingAnglePow5));
    const fresnelWeight = fresnelSchlick.mul(uniforms.uFresnelScale).clamp();

    // 5. screen color
    const safeScreenUv = mix(screenUV, refractedScreenUv, isSafe);
    const screenColor = viewportTexture(safeScreenUv).rgb;

    // 6. surface highlights
    const reflectedLight = reflect(uniforms.uSunDir, normal);
    const align = max(dot(reflectedLight, viewDir), 0.0);
    const spec = pow(align, uniforms.uShininess);
    const fresnelSpecBoost = mix(
      float(1),
      fresnelSchlick,
      uniforms.uHighlightFresnelInfluence,
    );
    const sunGlint = uniforms.uSunColor.mul(
      spec.mul(uniforms.uHighlightsGlow).mul(fresnelSpecBoost),
    );

    // 7. opacity
    const distanceXZSquared = dot(
      positionWorld.xz.sub(cameraPosition.xz),
      positionWorld.xz.sub(cameraPosition.xz),
    );

    const min2 = uniforms.uMinDist.mul(uniforms.uMinDist);
    const max2 = uniforms.uMaxDist.mul(uniforms.uMaxDist);

    const opacity = smoothstep(min2, max2, distanceXZSquared)
      .add(uniforms.uMinOpacity)
      .clamp();

    // 8. beer-lambert
    const sigma = uniforms.uAbsorptionRGB.mul(uniforms.uAbsorptionScale);
    const waterThickness = mix(waterDepth, waterDepthRefr, isSafe);
    const transmittance = exp(sigma.negate().mul(waterThickness));

    const absorbedColor = screenColor.mul(transmittance);
    const fillColor = uniforms.uInscatterTint
      .mul(float(1.0).sub(transmittance))
      .mul(uniforms.uInscatterStrength);
    const throughWater = absorbedColor.add(fillColor);

    // 9. final color
    const shadedWater = mix(throughWater, reflectedColor, fresnelWeight);
    const color = mix(screenColor, shadedWater, opacity);
    this.colorNode = color.add(sunGlint);
  }
}
