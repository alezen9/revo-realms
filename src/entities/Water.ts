import { Color, Mesh, PlaneGeometry, Vector2, Vector3 } from "three";
import { sceneManager } from "../systems/SceneManager";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import {
  cameraPosition,
  cameraProjectionMatrix,
  cubeTexture,
  dot,
  exp2,
  float,
  int,
  log2,
  max,
  mix,
  normalize,
  positionView,
  positionWorld,
  pow,
  reflect,
  reflectVector,
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
  uUvScale: uniform(3),
  uRefractionStrength: uniform(0.02),
  uWaterColor: uniform(new Color(0.0, 0.09, 0.09)),
  uFresnelScale: uniform(0.075),
  uSpeed: uniform(0.1),
  uNoiseScrollDir: uniform(new Vector2(0.1, 0)),
  uShiness: uniform(400),
  uMinDist: uniform(10),
  uMaxDist: uniform(50),
  uFromSunDir: uniform(new Vector3(0, -1, 0)),
};

export default class Water {
  constructor() {
    uniforms.uFromSunDir.value.copy(lighting.sunDirection);
    const waterObject = assetManager.realmModel.scene.getObjectByName(
      "water",
    ) as Mesh;
    const bb = waterObject.geometry.boundingBox!;
    const width = Math.abs(bb.min.x) + Math.abs(bb.max.x);
    const height = Math.abs(bb.min.z) + Math.abs(bb.max.z);
    const geometry = new PlaneGeometry(width, height);
    geometry.rotateX(-Math.PI / 2);
    const material = new WaterMaterial();
    const water = new Mesh(geometry, material);
    water.position.copy(waterObject.position);
    water.renderOrder = 100;

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
    folder.addBinding(uniforms.uWaterColor, "value", {
      label: "Water color",
      view: "color",
      color: { type: "float" },
    });
  }

  private createMaterial() {
    this.precision = "lowp";

    // 0. distortion
    const speed = time.mul(uniforms.uSpeed);
    const frequency = uniforms.uNoiseScrollDir.mul(speed);
    const nUV1 = uv().add(frequency).mul(uniforms.uUvScale).fract();
    const tsn1 = texture(assetManager.waterNormal, nUV1).mul(2).sub(1);
    const nUV2 = uv().sub(frequency).mul(uniforms.uUvScale).fract();
    const tsn2 = texture(assetManager.waterNormal, nUV2).mul(2).sub(1);
    const tsn = tsn1.add(tsn2).rgb.normalize();
    const distortion = tsn.xy.mul(uniforms.uRefractionStrength); // NOTE: xy not xz because z is up in the texture

    // 1. depth
    const sceneDepth = viewportDepthTexture(screenUV, 3).r;
    const p3z = cameraProjectionMatrix.element(3).element(2);
    const p2z = cameraProjectionMatrix.element(2).element(2);
    const sceneLinear = p3z.div(sceneDepth.add(p2z));
    const fragLinear = positionView.z.negate();
    const isUnderWater = step(fragLinear, sceneLinear);

    // 2. refracted UV
    const refractedScreenUv = screenUV.add(distortion.mul(isUnderWater));

    // 3. refracted depth
    const depthRefr = viewportDepthTexture(refractedScreenUv, 3).r;
    const sceneLinearRefr = p3z.div(depthRefr.add(p2z));
    const isSafe = step(fragLinear, sceneLinearRefr);

    // 4. reflection and fresnel
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const reflection = reflectVector.add(tsn).normalize();
    const reflectedColor = cubeTexture(
      assetManager.envMapTexture,
      reflection,
      3,
    );
    const fresnel = exp2(log2(float(1.0).sub(reflection)));
    const fresnelFactor = uniforms.uFresnelScale.mul(fresnel);
    const waterColor = mix(uniforms.uWaterColor, reflectedColor, fresnelFactor);

    // 5. screen color
    const safeScreenUv = mix(screenUV, refractedScreenUv, isSafe);
    const screenColor = viewportTexture(safeScreenUv, int(3)).rgb;

    // 6. surface highlights
    const reflectedLight = reflect(uniforms.uFromSunDir, tsn.rbg); // NOTE: rbg and not rgb, same reason as above
    const align = max(dot(reflectedLight, viewDir), 0.0);
    const spec = pow(align, uniforms.uShiness);
    const sunGlint = vec3(spec);

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
