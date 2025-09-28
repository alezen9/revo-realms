import { Color, Mesh, Vector2, Vector3 } from "three";
import { sceneManager } from "../systems/SceneManager";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import {
  cameraPosition,
  cameraProjectionMatrix,
  cubeTexture,
  dot,
  float,
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
  vec3,
  viewportDepthTexture,
  viewportTexture,
} from "three/tsl";
import { eventsManager } from "../systems/EventsManager";
import { debugManager } from "../systems/DebugManager";
import { audioManager } from "../systems/AudioManager";
import { lighting } from "../systems/LightingSystem";

const uniforms = {
  uUvScale: uniform(1.7),
  uRefractionStrength: uniform(0.01),
  uWaterColor: uniform(new Color(0.0, 0.09, 0.09)),
  uFresnelScale: uniform(0.075),
  uSpeed: uniform(0.1),
  uNoiseScrollDir: uniform(new Vector2(0.1, 0)),
  uShiness: uniform(700),
  uMinDist: uniform(10),
  uMaxDist: uniform(50),
  uFromSunDir: uniform(new Vector3(0, -1, 0)),
  uTworld: uniform(new Vector3(1, 0, 0)),
  uBworld: uniform(new Vector3(0, 0, -1)),
  uNworld: uniform(new Vector3(0, 1, 0)),
  uHighlightsFactor: uniform(2.5),
  // uFoamColor: uniform(new Color("white")),
  // uFoamDistance: uniform(0.125),
  // uDepthDistance: uniform(0.75),
  // uBeersCoefficient: uniform(0.6),
};

export default class Water {
  constructor() {
    const water = assetManager.realmModel.scene.getObjectByName(
      "water",
    ) as Mesh;
    water.material = new WaterMaterial();
    water.renderOrder = 100;

    uniforms.uFromSunDir.value.copy(lighting.sunDirection);
    uniforms.uTworld.value.applyNormalMatrix(water.normalMatrix).normalize();
    uniforms.uBworld.value.applyNormalMatrix(water.normalMatrix).normalize();
    uniforms.uNworld.value.applyNormalMatrix(water.normalMatrix).normalize();

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
      expanded: false,
    });

    folder.addBinding(uniforms.uSpeed, "value", {
      label: "Speed",
    });
    folder.addBinding(uniforms.uUvScale, "value", {
      label: "UV scale",
    });
    folder.addBinding(uniforms.uRefractionStrength, "value", {
      label: "Refraction strength",
    });
    folder.addBinding(uniforms.uShiness, "value", {
      label: "Shiness",
    });
    folder.addBinding(uniforms.uFresnelScale, "value", {
      label: "Fresnel scale",
    });
    folder.addBinding(uniforms.uMinDist, "value", {
      label: "Opacity min dist",
    });
    folder.addBinding(uniforms.uMaxDist, "value", {
      label: "Opacity max dist",
    });
    // folder.addBinding(uniforms.uFoamDistance, "value", {
    //   label: "Foam distance",
    // });
    // folder.addBinding(uniforms.uDepthDistance, "value", {
    //   label: "Depth distance",
    // });
    // folder.addBinding(uniforms.uBeersCoefficient, "value", {
    //   label: "Beer's coefficient",
    // });
    folder.addBinding(uniforms.uWaterColor, "value", {
      label: "Water color",
      view: "color",
      color: { type: "float" },
    });
    // folder.addBinding(uniforms.uFoamColor, "value", {
    //   label: "Foam color",
    //   view: "color",
    //   color: { type: "float" },
    // });
    folder.addBinding(uniforms.uHighlightsFactor, "value", {
      label: "Highlights glow factor",
    });
  }

  private createMaterial() {
    this.precision = "lowp";

    // 0. distortion
    const speed = time.mul(uniforms.uSpeed);
    const frequency = uniforms.uNoiseScrollDir.mul(speed);
    const nUV1 = uv().add(frequency).mul(uniforms.uUvScale.mul(1.7)).fract();
    const tsn1 = texture(assetManager.waterNormal, nUV1).mul(2).sub(1);
    const nUV2 = uv().sub(frequency).mul(uniforms.uUvScale.mul(1.3)).fract();
    const tsn2 = texture(assetManager.waterNormal, nUV2).mul(2).sub(1);
    const tsn = mix(tsn1, tsn2, 0.5).rgb.normalize();
    const distortion = tsn.xy.mul(uniforms.uRefractionStrength); // NOTE: xy not xz because tangent space
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
    // const fragmentDepth = sceneLinear.sub(fragLinear);
    // const waterDepth = fragmentDepth.div(uniforms.uDepthDistance).clamp();

    // 2. refracted UV
    const refractedScreenUv = screenUV.add(distortion.mul(isUnderWater));

    // 3. refracted depth
    const depthRefr = viewportDepthTexture(refractedScreenUv).r;
    const sceneLinearRefr = p3z.div(depthRefr.add(p2z));
    const isSafe = step(fragLinear, sceneLinearRefr);
    // const fragmentDepthRefr = sceneLinearRefr.sub(fragLinear);
    // const waterDepthRefr = fragmentDepthRefr
    //   .div(uniforms.uDepthDistance)
    //   .clamp();
    // const waterDepthBeerRefr = float(1).sub(
    //   exp(waterDepthRefr.mul(uniforms.uBeersCoefficient.negate())),
    // );
    // const waterDepthBeerFinal = mix(waterDepth, waterDepthBeerRefr, isSafe);

    // 4. reflection and fresnel
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const reflectVector = reflect(viewDir.negate(), normal).normalize();
    const reflectedColor = cubeTexture(
      assetManager.envMapTexture,
      reflectVector,
    );

    // Schlick's Fresnel approx F0 + (1 - F0) (1 - cos(theta))^5
    const NdotV = max(dot(normal, viewDir), 0.0); // view angle factor
    const F0 = float(0.02); // base reflectivity at head-on view (2% for water)
    const fresnelSchlick = F0.add(
      float(1.0)
        .sub(F0)
        .mul(pow(float(1.0).sub(NdotV), 5.0)),
    );
    const waterColor = mix(
      uniforms.uWaterColor,
      reflectedColor,
      fresnelSchlick.mul(uniforms.uFresnelScale),
    );

    // const foamFactor = step(uniforms.uFoamDistance, waterDepthBeerFinal);
    // const waterColor = mix(uniforms.uFoamColor, waterColor1, foamFactor);

    // 5. screen color
    const safeScreenUv = mix(screenUV, refractedScreenUv, isSafe);
    const screenColor = viewportTexture(safeScreenUv).rgb;

    // 6. surface highlights
    const reflectedLight = reflect(uniforms.uFromSunDir, normal);
    const align = max(dot(reflectedLight, viewDir), 0.0);
    const spec = pow(align, uniforms.uShiness);
    const sunGlint = vec3(spec).mul(uniforms.uHighlightsFactor);

    // 7. opacity
    const distanceXZSquared = dot(
      positionWorld.xz.sub(cameraPosition.xz),
      positionWorld.xz.sub(cameraPosition.xz),
    );

    const minDist = uniforms.uMinDist; // Minimum distance (fully transparent at this distance)
    const maxDist = uniforms.uMaxDist; // Maximum distance (fully opaque at this distance)

    const opacity = mix(
      0.05,
      0.5,
      smoothstep(minDist.mul(minDist), maxDist.mul(maxDist), distanceXZSquared),
    );

    const color = mix(screenColor, waterColor, opacity);
    this.colorNode = color.add(sunGlint);
  }
}
