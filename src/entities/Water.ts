import { Color, Mesh, Vector2, Vector3 } from "three";
import { sceneManager } from "../systems/SceneManager";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import {
  abs,
  cameraPosition,
  clamp,
  cubeTexture,
  dot,
  exp,
  exp2,
  float,
  Fn,
  fract,
  hash,
  log2,
  mix,
  modelNormalMatrix,
  normalize,
  positionLocal,
  positionWorld,
  reflect,
  sin,
  smoothstep,
  step,
  texture,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  vertexIndex,
} from "three/tsl";
import { State } from "../Game";
import { eventsManager } from "../systems/EventsManager";
import { debugManager } from "../systems/DebugManager";
import { audioManager } from "../systems/AudioManager";
import { isMeshVisible } from "../utils/isMeshVisible";

export default class Water {
  constructor() {
    const water = assetManager.realmModel.scene.getObjectByName(
      "water",
    ) as Mesh;
    const material = new WaterMaterial();
    water.material = material;

    sceneManager.scene.add(water);

    eventsManager.on("update", (state) => {
      if (!isMeshVisible(water)) return;
      material.update(state);
    });

    eventsManager.on("audio-ready", () => {
      water.add(audioManager.lake);
    });
  }
}

class WaterMaterial extends MeshBasicNodeMaterial {
  private playerDir = new Vector2(0, 0);

  private uSpeed = uniform(0.0075);
  private uScale1 = uniform(1);
  private uScale2 = uniform(4);
  private uWaveFrequency = uniform(0.25);
  private uWaveAmplitude = uniform(0.075);

  private uFresnelScale = uniform(0.325);
  private uMinDist = uniform(15);
  private uMaxDist = uniform(35);

  private uBaseColor = uniform(new Color().setRGB(0.05, 0.09, 0.08));

  uPlayerPosition = uniform(new Vector3(0, 0, 0));
  uPlayerDirection = uniform(new Vector2(0, 0));

  uRippleStrength = uniform(0.2);
  uMaxYDiff = uniform(1);
  uMaxDistSq = uniform(9);

  uRings = uniform(3);
  uAmplitude = uniform(0.5);

  uRipplesScale = uniform(0.3);

  constructor() {
    super();
    this.createMaterial();
    this.debugWater();
  }

  private debugWater() {
    const waterFolder = debugManager.panel.addFolder({
      title: "🌊 Water",
      expanded: false,
    });
    waterFolder.addBinding(this.uSpeed, "value", {
      label: "Speed",
    });
    waterFolder.addBinding(this.uScale1, "value", {
      label: "UV Scale 1",
    });
    waterFolder.addBinding(this.uScale2, "value", {
      label: "UV Scale 2",
    });
    waterFolder.addBinding(this.uWaveFrequency, "value", {
      label: "Wave frequency",
    });
    waterFolder.addBinding(this.uWaveAmplitude, "value", {
      label: "Wave amplitude",
    });
    waterFolder.addBinding(this.uFresnelScale, "value", {
      label: "Fresnel strength",
    });
    waterFolder.addBinding(this.uMinDist, "value", {
      label: "Opacity min dist",
    });
    waterFolder.addBinding(this.uMaxDist, "value", {
      label: "Opacity max dist",
    });
    waterFolder.addBinding(this.uBaseColor, "value", {
      label: "Base color",
      view: "color",
      color: { type: "float" },
    });
    waterFolder.addBinding(this.uRippleStrength, "value", {
      min: 0,
      max: 10,
      label: "Ripple strength",
    });
    waterFolder.addBinding(this.uMaxYDiff, "value", {
      min: -10,
      max: 10,
      label: "Y Max diff",
    });
    waterFolder.addBinding(this.uMaxDistSq, "value", {
      min: 0,
      max: 50,
      label: "Max dist",
    });
    waterFolder.addBinding(this.uRings, "value", {
      min: 0,
      max: 10,
      label: "# Rings",
    });
    waterFolder.addBinding(this.uAmplitude, "value", {
      min: 0,
      max: 10,
      label: "Amplitude ripples",
    });
    waterFolder.addBinding(this.uRipplesScale, "value", {
      min: 0,
      max: 3,
      label: "Ripples scale",
    });
  }

  update(state: State) {
    const { player } = state;

    // Ripples
    const dx = player.position.x - this.uPlayerPosition.value.x;
    const dz = player.position.z - this.uPlayerPosition.value.z;
    this.playerDir.set(dx, dz);
    this.uPlayerDirection.value.lerp(this.playerDir, 0.5).normalize();
    this.uPlayerPosition.value.copy(player.position);
  }

  private computeRipples = Fn(() => {
    const posXZ = positionWorld.xz;
    const playerXZ = this.uPlayerPosition.xz;
    const playerDir = normalize(this.uPlayerDirection);
    const playerY = this.uPlayerPosition.y;

    const delta = posXZ.sub(playerXZ);
    const distSq = dot(delta, delta);

    const inRange = step(distSq, this.uMaxDistSq);
    const yDiff = abs(playerY.sub(positionWorld.y));
    const heightOk = smoothstep(
      this.uMaxYDiff.add(0.5),
      this.uMaxYDiff.negate().add(0.5),
      yDiff,
    );

    const rings = this.uRings;
    const phase = time.sub(distSq.mul(0.5));
    const wave = sin(phase.mul(rings)).mul(
      exp(distSq.negate().mul(this.uAmplitude)),
    );

    const directionFactor = dot(normalize(delta), playerDir).mul(0.5).add(0.5);
    const forwardArc = smoothstep(0.05, 0.95, directionFactor);

    const ripple = wave
      .mul(forwardArc)
      .mul(this.uRippleStrength)
      .mul(inRange)
      .mul(heightOk);

    return vec3(ripple);
  });

  private tangentToObject = Fn(([tn = vec3(0)]) => {
    // Hard-coded plane TBN
    const T = vec3(1, 0, 0);
    const B = vec3(0, 0, -1);
    const N = vec3(0, 1, 0);

    // objectN = tn.x*T + tn.y*B + tn.z*N
    return tn.x.mul(T).add(tn.y.mul(B)).add(tn.z.mul(N));
  });

  private objectToWorld = Fn(([objN = vec3(0)]) => {
    // modelNormalMatrix does object→world normal transform
    return normalize(modelNormalMatrix.mul(objN));
  });

  private sampleTangentNormal = Fn(([uvCoords = vec2(0)]) => {
    // Typical normal map: (R,G,B) in [0..1]
    const tex = texture(assetManager.waterNormal, uvCoords);

    // Unpack from [0..1] to [-1..1]
    // typical formula: tangentSpaceN = 2*(R,G,B) - 1
    // This yields (r, g, b)
    const tangentN = vec3(
      tex.r.mul(2).sub(1),
      tex.g.mul(2).sub(1),
      tex.b.mul(2).sub(1),
    );
    return tangentN;
  });

  private computeNormal = Fn(() => {
    const ripple = this.computeRipples();
    const rippleOffset = ripple.xz.mul(this.uRipplesScale);
    const timer = time.mul(this.uSpeed).add(rippleOffset);

    // First sample
    const _uv1 = fract(uv().mul(this.uScale1).add(timer));
    const nor1 = this.sampleTangentNormal(_uv1);

    // Second sample
    const _uv2 = fract(uv().mul(this.uScale2).sub(timer));
    const nor2 = this.sampleTangentNormal(_uv2);

    // Third sample
    const _uv3 = fract(uv().mul(this.uScale2.mul(this.uScale1)).add(timer));
    const nor3 = this.sampleTangentNormal(_uv3);

    // Combined
    const mix1 = mix(nor1, nor2, 0.5);
    const mix2 = mix(mix1, nor3, 0.5);
    const objectN = this.tangentToObject(mix2);
    const worldN = this.objectToWorld(objectN);
    return worldN;
  });

  private computeFresnelFactor = Fn(
    ([normal = vec3(0), viewDirection = vec3(0)]) => {
      const factor = exp2(
        log2(float(1.0).sub(clamp(dot(viewDirection, normal), 0.0, 1.0))),
      );
      const fresnel = this.uFresnelScale.mul(factor);
      return fresnel;
    },
  );

  private computeReflectionColor = Fn(
    ([normal = vec3(0), viewDirection = vec3(0)]) => {
      const reflection = reflect(viewDirection, normal);
      return cubeTexture(assetManager.envMapTexture, reflection);
    },
  );

  private computeColorOpacity = Fn(() => {
    const distanceXZSquared = dot(
      positionWorld.xz.sub(cameraPosition.xz),
      positionWorld.xz.sub(cameraPosition.xz),
    );

    const minDist = this.uMinDist; // Minimum distance (fully transparent at this distance)
    const maxDist = this.uMaxDist; // Maximum distance (fully opaque at this distance)

    const opacity = mix(
      0.05,
      0.5,
      smoothstep(minDist.mul(minDist), maxDist.mul(maxDist), distanceXZSquared),
    );
    return opacity;
  });

  private computeColor = Fn(() => {
    const normal = this.computeNormal();
    const viewDirection = normalize(cameraPosition.sub(positionWorld));

    const reflectionColor = this.computeReflectionColor(normal, viewDirection);
    const fresnelFactor = this.computeFresnelFactor(normal, viewDirection);

    const color = mix(this.uBaseColor.rgb, reflectionColor.rgb, fresnelFactor);
    const opacity = this.computeColorOpacity();
    return vec4(color.rgb, opacity);
  });

  private computePosition = Fn(() => {
    const random = hash(positionLocal.xz).add(vertexIndex).mul(0.015);
    const offset = sin(time.mul(random).mul(this.uWaveFrequency)).mul(
      this.uWaveAmplitude,
    );
    return positionLocal.add(vec3(0, offset, 0));
  });

  private createMaterial() {
    this.precision = "lowp";
    this.transparent = true;

    // Position
    this.positionNode = this.computePosition();

    // Diffuse
    this.colorNode = this.computeColor();
  }
}
