import { Color, Mesh, PlaneGeometry, Vector2, Vector3 } from "three";
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
  normalize,
  positionLocal,
  positionWorld,
  reflect,
  sin,
  smoothstep,
  step,
  texture,
  uniform,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import { State } from "../Game";
import { eventsManager } from "../systems/EventsManager";
import { debugManager } from "../systems/DebugManager";

export default class Water2 {
  constructor() {
    const geom = new PlaneGeometry(128, 128, 10, 10);
    geom.rotateX(-Math.PI / 2);
    const mat = new WaterMaterial();
    const mesh = new Mesh(geom, mat);

    mesh.position.set(-64, -0.25, 64);

    sceneManager.scene.add(mesh);
  }
}

class WaterMaterial extends MeshBasicNodeMaterial {
  private playerDir = new Vector2(0, 0);

  private uTime = uniform(0);
  private uScale1 = uniform(0.5);
  private uScale2 = uniform(2.5);
  private uScaleOffset = uniform(0.05);

  private uFresnelScale = uniform(0.65);
  private uMinDist = uniform(25);
  private uMaxDist = uniform(70);

  private uBaseColor = uniform(new Color().setRGB(0.25, 0.41, 0.39));

  uPlayerPosition = uniform(new Vector3(0, 0, 0));
  uPlayerDirection = uniform(new Vector2(0, 0));

  uRippleStrength = uniform(0.2);
  uMaxYDiff = uniform(1);
  uMaxDistSq = uniform(9);

  constructor() {
    super();

    this.createMaterial();

    eventsManager.on("update", this.update.bind(this));

    this.debugWater();
  }

  private debugWater() {
    debugManager.panel.addBinding(this.uScale1, "value", {
      label: "UvScale 1",
    });
    debugManager.panel.addBinding(this.uScale2, "value", {
      label: "UvScale 2",
    });
    debugManager.panel.addBinding(this.uScaleOffset, "value", {
      label: "Displacement scale",
    });
    debugManager.panel.addBinding(this.uFresnelScale, "value", {
      label: "Fresnel strength",
    });
    debugManager.panel.addBinding(this.uMinDist, "value", {
      label: "Opacity min dist",
    });
    debugManager.panel.addBinding(this.uMaxDist, "value", {
      label: "Opacity max dist",
    });
    debugManager.panel.addBinding(this.uBaseColor, "value", {
      label: "Base color",
      view: "color",
      color: { type: "float" },
    });
  }

  private update(state: State) {
    const { clock, player } = state;
    this.uTime.value = clock.getElapsedTime();

    // Ripples
    const dx = player.position.x - this.uPlayerPosition.value.x;
    const dz = player.position.z - this.uPlayerPosition.value.z;
    this.playerDir.set(dx, dz);
    this.uPlayerDirection.value.lerp(this.playerDir, 0.5).normalize();
    this.uPlayerPosition.value.copy(player.position);
  }

  private transformWaterNormal = Fn(([normal = vec3(0)]) => {
    return vec3(normal.a.mul(2).sub(1), normal.b, normal.g.mul(2).sub(1));
  });

  private computeNormal = Fn(() => {
    const timer = this.uTime.mul(0.0025);

    // First sample
    const _uv1 = fract(uv().mul(this.uScale1).add(timer));
    const nor1 = texture(assetManager.waterNormal, _uv1);
    const adjustedNor1 = this.transformWaterNormal(nor1);

    // Second sample
    const _uv2 = fract(uv().mul(this.uScale2).sub(timer));
    const nor2 = texture(assetManager.waterNormal, _uv2);
    const adjustedNor2 = this.transformWaterNormal(nor2);

    // Third sample
    const _uv3 = fract(uv().mul(this.uScale2.mul(this.uScale1)).sub(timer));
    const nor3 = texture(assetManager.waterNormal, _uv3);
    const adjustedNor3 = this.transformWaterNormal(nor3);

    // Combined
    const mix1 = mix(adjustedNor1, adjustedNor2, 0.5);
    const mix2 = mix(mix1, adjustedNor3, 0.5);
    return mix2;
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
      const reflectedDirection = reflect(viewDirection, normal).normalize();
      return cubeTexture(assetManager.envMapTexture, reflectedDirection);
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

    const rings = 3.0;
    const phase = this.uTime.sub(distSq.mul(0.5));
    const wave = sin(phase.mul(rings)).mul(exp(distSq.negate().mul(0.25)));

    const directionFactor = dot(normalize(delta), playerDir).mul(0.5).add(0.5);
    const forwardArc = smoothstep(0.05, 0.95, directionFactor);

    const ripple = wave
      .mul(forwardArc)
      .mul(this.uRippleStrength)
      .mul(inRange)
      .mul(heightOk);

    return vec3(ripple);
  });

  private computeColor = Fn(() => {
    const normal = this.computeNormal();
    const viewDirection = normalize(positionWorld.sub(cameraPosition));

    const reflectionColor = this.computeReflectionColor(normal, viewDirection);
    const fresnelFactor = this.computeFresnelFactor(normal, viewDirection);

    const color = mix(this.uBaseColor.rgb, reflectionColor.rgb, fresnelFactor);
    const ripples = this.computeRipples();
    color.addAssign(ripples);
    const opacity = this.computeColorOpacity();
    return vec4(color.rgb, opacity);
  });

  private computePosition = Fn(() => {
    const random = hash(positionLocal.xz);
    const offset = sin(this.uTime.add(random)).mul(this.uScaleOffset);
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
