import {
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  StaticDrawUsage,
  Vector2,
  Vector3,
} from "three";
import {
  Fn,
  mix,
  uniform,
  uv,
  instancedArray,
  instanceIndex,
  hash,
  float,
  floor,
  vec3,
  vec4,
  smoothstep,
  vec2,
  texture,
  step,
  sin,
  abs,
  max,
  clamp,
  If,
  Discard,
  mod,
  time,
  PI2,
  remap,
  fract,
} from "three/tsl";
import { assetManager } from "../../systems/AssetManager/AssetManager";
import { debugManager } from "../../systems/DebugManager";
import { rendererManager } from "../../systems/RendererManager";
import { sceneManager } from "../../systems/SceneManager";
import { eventsManager } from "../../systems/EventsManager";
import { tslUtils } from "../../utils/TSLUtils";
import { SpriteNodeMaterial } from "three/webgpu";

const getConfig = () => {
  const BLADE_WIDTH = 0.125;
  const BLADE_HEIGHT = 2;
  const TILE_SIZE = 150;
  const BLADES_PER_SIDE = 512 + 256; // power of 2 is optimal, divisible by wg also good
  return {
    BLADE_WIDTH,
    BLADE_HEIGHT,
    BLADE_BOUNDING_SPHERE_RADIUS: BLADE_HEIGHT,
    TILE_SIZE,
    TILE_HALF_SIZE: TILE_SIZE / 2,
    BLADES_PER_SIDE,
    COUNT: BLADES_PER_SIDE * BLADES_PER_SIDE,
    SPACING: TILE_SIZE / BLADES_PER_SIDE,
    WORKGROUP_SIZE: 256,
  };
};
const config = getConfig();

const uniforms = {
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uCameraMatrix: uniform(new Matrix4()),
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),
  // Scale
  uBladeMinScale: uniform(0.75),
  uBladeMaxScale: uniform(1.25),
  // Trail
  uTrailGrowthRate: uniform(0.04),
  uTrailMinScale: uniform(0.5),
  uTrailRaius: uniform(1),
  uTrailRaiusSquared: uniform(1),
  uKDown: uniform(0.8),
  // Wind
  uWindStrength: uniform(1.25),
  uWindSpeed: uniform(0.2),
  uvWindScale: uniform(0.025),
  uWindDirection: uniform(new Vector2(0.5, 0.5)),
  // Color
  uBaseColor: uniform(new Color().setRGB(0.07, 0.07, 0)),
  uTipColor: uniform(new Color().setRGB(0.23, 0.11, 0.05)),
  uWindColorScale: uniform(1.5),
  uAoScale: uniform(1.75),
  uAoRimSmoothness: uniform(5),
  uColorMixFactor: uniform(1),
  // Stochastic keep
  uR0: uniform(45),
  uR1: uniform(75),
  uPMin: uniform(0.1),
};

class GrassSsbo {
  // x -> offsetX (0 unused)
  // y -> offsetZ (0 unused)
  // z -> 0/12 windX - 12/12 windZ (0 unused)
  // w -> 0/8 current scale - 8/8 original scale - 16/1 shadow - 17/1 visibility - 18/4 wind noise factor (0 unused)
  private buffer: ReturnType<typeof instancedArray>;

  constructor() {
    this.buffer = instancedArray(config.COUNT, "vec4");
    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
  }

  get computeBuffer() {
    return this.buffer;
  }

  getWind = Fn(([data = vec4(0)]) => {
    const x = tslUtils.unpackUnits(data.z, 0, 12, -2, 2);
    const z = tslUtils.unpackUnits(data.z, 12, 12, -2, 2);
    return vec2(x, z);
  });

  getScale = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackUnits(
      data.w,
      0,
      8,
      uniforms.uTrailMinScale,
      uniforms.uBladeMaxScale,
    );
  });

  getOriginalScale = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackUnits(
      data.w,
      8,
      8,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
  });

  getShadow = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackFlag(data.w, 16);
  });

  getVisibility = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackFlag(data.w, 17);
  });

  getGlow = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackUnit(data.w, 18, 6);
  });

  private setWind = Fn(([data = vec4(0), value = vec2(0)]) => {
    data.z = tslUtils.packUnits(data.z, 0, 12, value.x, -2, 2);
    data.z = tslUtils.packUnits(data.z, 12, 12, value.y, -2, 2);
    return data;
  });

  private setScale = Fn(([data = vec4(0), value = float(0)]) => {
    data.w = tslUtils.packUnits(
      data.w,
      0,
      8,
      value,
      uniforms.uTrailMinScale,
      uniforms.uBladeMaxScale,
    );
    return data;
  });

  private setOriginalScale = Fn(([data = vec4(0), value = float(0)]) => {
    data.w = tslUtils.packUnits(
      data.w,
      8,
      8,
      value,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
    return data;
  });

  private setShadow = Fn(([data = vec4(0), value = float(0)]) => {
    data.w = tslUtils.packFlag(data.w, 16, value);
    return data;
  });

  private setVisibility = Fn(([data = vec4(0), value = float(0)]) => {
    data.w = tslUtils.packFlag(data.w, 17, value);
    return data;
  });

  private setGlow = Fn(([data = vec4(0), value = float(0)]) => {
    data.w = tslUtils.packUnit(data.w, 18, 6, value);
    return data;
  });

  private computeInit = Fn(() => {
    const data = this.buffer.element(instanceIndex);
    // Position XZ
    const row = floor(float(instanceIndex).div(config.BLADES_PER_SIDE));
    const col = float(instanceIndex).mod(config.BLADES_PER_SIDE);
    const randX = hash(instanceIndex.add(4321));
    const randZ = hash(instanceIndex.add(1234));
    const offsetX = col
      .mul(config.SPACING)
      .sub(config.TILE_HALF_SIZE)
      .add(randX.mul(config.SPACING * 0.5));
    const offsetZ = row
      .mul(config.SPACING)
      .sub(config.TILE_HALF_SIZE)
      .add(randZ.mul(config.SPACING * 0.5));
    const _uv = vec3(offsetX, 0, offsetZ)
      .xz.add(config.TILE_HALF_SIZE)
      .div(config.TILE_SIZE)
      .abs()
      .fract();
    const noise = texture(assetManager.resources.noiseTexture, _uv);
    const noiseX = noise.r.sub(0.5).mul(17).fract();
    const noiseZ = noise.b.sub(0.5).mul(13).fract();
    data.x = offsetX.add(noiseX);
    data.y = offsetZ.add(noiseZ);
    // Scale
    const randomScale = remap(
      noise.b,
      0,
      1,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
    data.assign(this.setScale(data, randomScale));
    data.assign(this.setOriginalScale(data, randomScale));
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);

  private computeStochasticKeep = Fn(([worldPos = vec3(0)]) => {
    // world-space radial thinning (no sqrt)
    const dx = worldPos.x.sub(uniforms.uPlayerPosition.x);
    const dz = worldPos.z.sub(uniforms.uPlayerPosition.z);
    const distSq = dx.mul(dx).add(dz.mul(dz));

    const R0 = uniforms.uR0,
      R1 = uniforms.uR1,
      pMin = uniforms.uPMin;
    const R0Sq = R0.mul(R0),
      R1Sq = R1.mul(R1);

    // 0 inside R0, 1 at/after R1
    const t = clamp(distSq.sub(R0Sq).div(max(R1Sq.sub(R0Sq), 1e-5)), 0.0, 1.0);

    // keep probability from 1 → pMin
    const p = mix(1.0, pMin, t);

    // deterministic RNG per blade (stable under wrap)
    const rnd = hash(float(instanceIndex).mul(0.73));

    const keep = step(rnd, p);
    return keep;
  });

  private computeVisibility = Fn(([worldPos = vec3(0)]) => {
    const clipPos = uniforms.uCameraMatrix.mul(vec4(worldPos, 1.0));
    // Convert to normalized device coordinates
    const ndc = clipPos.xyz.div(clipPos.w);
    // Compute an approximate threshold for the blade's radius in NDC space.
    const radiusNDC = config.BLADE_BOUNDING_SPHERE_RADIUS;
    // Check if the sphere (centered at ndc with "radiusNDC") is at least partially within the clip volume:
    const one = float(1);
    const visible = step(one.negate().sub(radiusNDC), ndc.x)
      .mul(step(ndc.x, one.add(radiusNDC)))
      .mul(step(one.negate().sub(radiusNDC), ndc.y))
      .mul(step(ndc.y, one.add(radiusNDC)))
      .mul(step(0.0, ndc.z)) // Ensure it's in front of the near plane
      .mul(step(ndc.z, one)); // Ensure it's inside the far plane
    // visible will be 1 if inside, 0 if outside.
    return visible;
  });

  private computeWind = Fn(([prevWindXZ = vec2(0), worldPos = vec3(0)]) => {
    const dir = uniforms.uWindDirection.normalize();

    // --- gentle per-instance speed jitter (±10 %)
    const rand = fract(sin(float(instanceIndex).mul(91.7)).mul(43758.5453));
    const speed = uniforms.uWindSpeed.mul(mix(0.9, 1.1, rand));

    // base uv + scroll
    const uvBase = worldPos.xz.mul(uniforms.uvWindScale);
    const scroll = dir.mul(speed).mul(time);

    // sample 1 — main noise
    const uvA = uvBase.add(scroll);
    const nA = texture(assetManager.resources.noiseAtlas, uvA)
      .mul(2.0)
      .sub(1.0);

    // sample 2 — same texture, just different frequency & offset
    const uvB = uvBase.mul(1.37).add(scroll.mul(1.11)).add(vec2(0.31, 0.73));
    const nB = texture(assetManager.resources.noiseAtlas, uvB)
      .mul(2.0)
      .sub(1.0);

    // mix them — random per instance + slow time wobble
    const mixRand = fract(sin(float(instanceIndex).mul(12.9898)).mul(78.233));
    const mixTime = sin(time.mul(0.4).add(float(instanceIndex).mul(0.1))).mul(
      0.25,
    );
    const w = clamp(mixRand.add(mixTime), 0.2, 0.8);
    const n = mix(nA, nB, w);

    const baseMag = n.r.mul(uniforms.uWindStrength);
    const gustMag = n.g.mul(uniforms.uWindStrength).mul(0.35);
    const windFactor = baseMag.add(gustMag);

    const target = dir.mul(windFactor);
    const k = mix(0.08, 0.25, abs(n.b)); // smooth damping
    const newWind = prevWindXZ.add(target.sub(prevWindXZ).mul(k));

    return vec3(newWind, windFactor);
  });

  private computeAlpha = Fn(([worldPos = vec3(0)]) => {
    const alphaUv = tslUtils.computeMapUvByPosition(worldPos.xz);
    const alpha = texture(assetManager.resources.terrainTypeTexture, alphaUv).g;
    const threshold = step(0.25, alpha);
    return threshold;
  });

  private computeTrailScale = Fn(
    (
      [originalScale = float(0), currentScale = float(0), isStepped = float(0)], // isStepped in [0,1]
    ) => {
      // Upward relax toward original (no step)
      const up = currentScale.add(
        originalScale.sub(currentScale).mul(uniforms.uTrailGrowthRate),
      );

      // Downward crush toward min (when stepped)
      const down = currentScale.add(
        uniforms.uTrailMinScale.sub(currentScale).mul(uniforms.uKDown),
      );

      // Blend by contact (branchless). If your isStepped is hard 0/1, this still works.
      const blended = mix(up, down, isStepped);

      // Safe range
      return clamp(blended, uniforms.uTrailMinScale, originalScale);
    },
  );

  private computeShadow = Fn(([worldPos = vec3(0)]) => {
    const _uv = tslUtils.computeMapUvByPosition(worldPos.xz);
    const shadowAo = texture(
      assetManager.resources.terrainShadowAoTexture,
      _uv,
    );
    return step(0.65, shadowAo.r);
  });

  computeUpdate = Fn(() => {
    const data = this.buffer.element(instanceIndex);

    // Position
    const newOffsetX = mod(
      data.x.sub(uniforms.uPlayerDeltaXZ.x).add(config.TILE_HALF_SIZE),
      config.TILE_SIZE,
    ).sub(config.TILE_HALF_SIZE);

    const newOffsetZ = mod(
      data.y.sub(uniforms.uPlayerDeltaXZ.y).add(config.TILE_HALF_SIZE),
      config.TILE_SIZE,
    ).sub(config.TILE_HALF_SIZE);
    const pos = vec3(newOffsetX, 0, newOffsetZ);

    data.x = newOffsetX;
    data.y = newOffsetZ;

    const worldPos = pos.add(uniforms.uPlayerPosition);

    // Visibility
    const stochasticKeep = this.computeStochasticKeep(worldPos);
    const isVisible = this.computeVisibility(worldPos).mul(stochasticKeep);
    data.assign(this.setVisibility(data, isVisible));

    // Soft culling
    If(isVisible, () => {
      // Compute distance to player
      const diff = worldPos.xz.sub(uniforms.uPlayerPosition.xz);
      const distSq = diff.dot(diff);

      // Check if the player is on the ground
      const isPlayerGrounded = step(
        0.1,
        float(1).sub(uniforms.uPlayerPosition.y),
      );
      const contact = float(1)
        .sub(smoothstep(0.0, uniforms.uTrailRaiusSquared, distSq))
        .mul(isPlayerGrounded);

      // Trail
      const currentScale = this.getScale(data);
      const originalScale = this.getOriginalScale(data);
      const newScale = this.computeTrailScale(
        originalScale,
        currentScale,
        contact,
      );
      data.assign(this.setScale(data, newScale));

      // Alpha
      const alpha = this.computeAlpha(worldPos);
      data.assign(this.setVisibility(data, alpha));

      // Wind
      const prevWind = this.getWind(data);
      const newWind = this.computeWind(prevWind, worldPos);
      data.assign(this.setWind(data, newWind.xy)); // Wind displacement
      data.assign(this.setGlow(data, newWind.z)); // Noise factor

      // // Shadow
      // const isShadow = this.computeShadow(worldPos);
      // data.assign(this.setShadow(data, isShadow));
    });
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);
}

class GrassMaterial extends SpriteNodeMaterial {
  private ssbo: GrassSsbo;
  constructor(ssbo: GrassSsbo) {
    super();
    this.ssbo = ssbo;
    this.createGrassMaterial();
  }

  private computeDiffuse = Fn(
    ([windNoiseFactor = float(0), isShadow = float(1)]) => {
      const baseToTip = mix(
        uniforms.uBaseColor,
        uniforms.uTipColor,
        uv().y.mul(uniforms.uColorMixFactor).clamp(),
      );

      const variation = float(1).sub(windNoiseFactor.remap(0, 1, 0.25, 0.75));

      const withVariation = baseToTip
        .mul(variation)
        .mul(uniforms.uWindColorScale);

      const withGlow = mix(baseToTip, withVariation, variation);

      // const withShadow = mix(withGlow.mul(0.5), withGlow, isShadow);

      return withGlow;
    },
  );

  private computeAO = Fn(([offsetX = float(0), offsetZ = float(0)]) => {
    // --- near factor: squared distance, no sqrt ---
    const dx = offsetX,
      dz = offsetZ;
    const r2 = dx.mul(dx).add(dz.mul(dz));
    const R0 = float(12.0),
      R1 = float(28.0);
    const near = float(1).sub(smoothstep(R0.mul(R0), R1.mul(R1), r2));

    // --- soft edge rim across blade width ---
    const x = uv().x; // 0..1
    const edge = abs(x.mul(2.0).sub(1.0)); // 0 center, 1 edge
    const rim = smoothstep(
      uniforms.uAoRimSmoothness.negate(),
      uniforms.uAoRimSmoothness,
      edge,
    );

    // --- height weighting (keep base clean) ---
    const h = uv().y; // 0 base → 1 tip
    const hWeight = float(1).sub(smoothstep(0.1, 0.85, h));

    // --- AO strength controlled by uAoScale ---
    const aoStrength = uniforms.uAoScale.mul(0.25); // scale intensity
    const ao = float(1).sub(aoStrength.mul(near.mul(rim).mul(hWeight)));

    return ao;
  });

  private createGrassMaterial() {
    this.precision = "lowp";
    this.transparent = false;
    const data = this.ssbo.computeBuffer.element(instanceIndex);
    this.alphaTest = 0.9;

    const offsetX = data.x;
    const offsetZ = data.y;
    const windXZ = this.ssbo.getWind(data);
    const scale = this.ssbo.getScale(data);
    const isVisible = this.ssbo.getVisibility(data);
    const windNoiseFactor = this.ssbo.getGlow(data);
    const isShadow = this.ssbo.getShadow(data);
    this.opacityNode = isVisible;

    Discard(isVisible.equal(0));
    const rand = hash(instanceIndex.add(196.4356));
    this.scaleNode = vec3(rand.remap(0, 1, 0.25, 1), scale, 1);
    const rotation = rand.sub(0.5);
    this.rotationNode = vec3(rotation.mul(0.5), 0, 0);
    const randomPhase = rand.mul(PI2); // Random phase in range [0, 2π]
    const swayAmount = sin(time.mul(5).add(randomPhase)).mul(0.15);
    const swayFactor = uv().y.mul(windNoiseFactor);
    const swayOffset = swayAmount.mul(swayFactor);

    const height = uv().y; // 0 at base → 1 at tip
    const profile = height.mul(height).mul(height); // softer near base
    const bendOffset = vec3(windXZ.x, 0.0, windXZ.y).mul(profile);

    // optional tiny flutter perpendicular to wind (adds life without rotating the sprite)
    const dirXZ = uniforms.uWindDirection.normalize();
    const perp = vec2(dirXZ.y.negate(), dirXZ.x);
    const phase = hash(instanceIndex).mul(PI2);
    const flutter = sin(
      time.mul(uniforms.uWindSpeed.mul(1.7)).add(phase.mul(1.3)),
    )
      .mul(0.06)
      .mul(profile);
    const flutterOff = vec3(perp.x, 0.0, perp.y).mul(flutter);
    const pos = vec3(offsetX, 0, offsetZ);
    this.positionNode = pos.add(bendOffset).add(flutterOff).add(swayOffset);
    const ao = this.computeAO(offsetX, offsetZ);
    const color = this.computeDiffuse(windNoiseFactor, isShadow);
    this.colorNode = color.mul(ao);
  }
}

export default class Grass {
  constructor() {
    const ssbo = new GrassSsbo();
    const geometry = this.createGeometry(3);
    const material = new GrassMaterial(ssbo);
    const grass = new InstancedMesh(geometry, material, config.COUNT);
    grass.frustumCulled = false;
    sceneManager.scene.add(grass);

    eventsManager.on("update-throttle-2x", ({ player }) => {
      const dx = player.position.x - grass.position.x;
      const dz = player.position.z - grass.position.z;
      uniforms.uPlayerDeltaXZ.value.set(dx, dz);
      uniforms.uPlayerPosition.value.copy(player.position);
      uniforms.uCameraMatrix.value
        .copy(sceneManager.playerCamera.projectionMatrix)
        .multiply(sceneManager.playerCamera.matrixWorldInverse);

      grass.position.copy(player.position).setY(0);

      rendererManager.renderer.computeAsync(ssbo.computeUpdate);
    });

    this.debugGrass();
  }

  private debugGrass() {
    const folder = debugManager.panel.addFolder({
      title: "🌱 Grass",
      expanded: true,
    });

    const color = folder.addFolder({ title: "Color" });
    color.addBinding(uniforms.uTipColor, "value", {
      label: "Tip",
      view: "color",
      color: { type: "float" },
    });
    color.addBinding(uniforms.uBaseColor, "value", {
      label: "Base",
      view: "color",
      color: { type: "float" },
    });
    color.addBinding(uniforms.uColorMixFactor, "value", {
      label: "Mix factor",
      min: 0,
      max: 2,
      step: 0.01,
    });
    color.addBinding(uniforms.uWindColorScale, "value", {
      label: "Wind color scale",
      min: 0,
      max: 5,
      step: 0.01,
    });
    color.addBinding(uniforms.uAoScale, "value", {
      label: "AO scale",
      min: 0,
      max: 5,
      step: 0.01,
    });
    color.addBinding(uniforms.uAoRimSmoothness, "value", {
      label: "AO rim smoothness",
      min: 0,
      max: 5,
      step: 0.01,
    });

    const wind = folder.addFolder({ title: "Wind" });
    wind.addBinding(uniforms.uWindStrength, "value", {
      label: "Strength",
      min: -Math.PI / 2,
      max: Math.PI / 2,
      step: 0.01,
    });
    wind.addBinding(uniforms.uWindSpeed, "value", {
      label: "Speed",
      min: 0,
      max: 2,
      step: 0.01,
    });
    wind.addBinding(uniforms.uvWindScale, "value", {
      label: "UV scale",
      step: 0.01,
    });
    wind.addBinding(uniforms.uWindDirection, "value", {
      label: "Direction",
    });

    const stochastic = folder.addFolder({ title: "Stochastic keep" });
    stochastic.addBinding(uniforms.uR0, "value", {
      label: "Inner ring",
      min: 0,
      max: config.TILE_SIZE,
      step: 0.1,
    });
    stochastic.addBinding(uniforms.uR1, "value", {
      label: "Outer ring",
      min: 0,
      max: config.TILE_SIZE,
      step: 0.1,
    });
    stochastic.addBinding(uniforms.uPMin, "value", {
      label: "P Min",
      min: 0,
      max: 1,
      step: 0.01,
    });

    const trail = folder.addFolder({ title: "Trail" });
    trail.addBinding(uniforms.uTrailGrowthRate, "value", {
      label: "Growth rate",
      min: 0,
      max: 0.1,
      step: 0.001,
    });
    trail.addBinding(uniforms.uTrailMinScale, "value", {
      label: "Min scale",
      min: 0,
      max: 1,
      step: 0.01,
    });
    trail.addBinding(uniforms.uKDown, "value", {
      label: "Crushing speed",
      min: 0,
      max: 5,
      step: 0.01,
    });
    trail
      .addBinding(uniforms.uTrailRaius, "value", {
        label: "Trail radius",
        min: 0,
        max: 2,
        step: 0.01,
      })
      .on("change", ({ value }) => {
        console.log(value);
        uniforms.uTrailRaiusSquared.value = value * value;
      });

    const general = folder.addFolder({ title: "General" });
    general.addBinding(uniforms.uBladeMinScale, "value", {
      label: "Min scale",
      min: 0,
      max: 5,
      step: 0.01,
    });
    general.addBinding(uniforms.uBladeMaxScale, "value", {
      label: "Max scale",
      min: 0,
      max: 5,
      step: 0.01,
    });
  }

  private createGeometry(nSegments: number) {
    const segments = Math.max(1, Math.floor(nSegments)); // total vertical slices
    const height = config.BLADE_HEIGHT;
    const halfWidthBase = config.BLADE_WIDTH * 0.5;

    // We have `segments` rows of (L,R) vertices, then a single tip vertex.
    const rowCount = segments; // #pair-rows
    const vertexCount = rowCount * 2 + 1; // 2 per row + tip
    const quadCount = Math.max(0, rowCount - 1); // quads between consecutive rows
    const indexCount = quadCount * 6 + 3; // 6 per quad + 3 for tip

    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = new Uint8Array(indexCount);
    const normals = new Float32Array(indexCount * 3);

    // simple taper: ~linear → narrower toward tip; tweak as you like
    const taper = (t: number) => halfWidthBase * (1.0 - 0.7 * t); // t in [0..1]

    // build rows
    let idx = 0; // write cursor for indices
    for (let row = 0; row < rowCount; row++) {
      const v = row / segments; // normalized height [0..(segments-1)/segments]
      const y = v * height;
      const halfWidth = taper(v);

      const left = row * 2;
      const right = left + 1;

      // positions
      positions[3 * left + 0] = -halfWidth;
      positions[3 * left + 1] = y;
      positions[3 * left + 2] = 0;

      positions[3 * right + 0] = halfWidth;
      positions[3 * right + 1] = y;
      positions[3 * right + 2] = 0;

      // uvs (L=0, R=1; V along height)
      uvs[2 * left + 0] = 0.0;
      uvs[2 * left + 1] = v;
      uvs[2 * right + 0] = 1.0;
      uvs[2 * right + 1] = v;

      // make a quad with the previous row (except for the very first row)
      if (row > 0) {
        const prevLeft = (row - 1) * 2;
        const prevRight = prevLeft + 1;

        // (prevL, prevR, currR) and (prevL, currR, currL)
        indices[idx++] = prevLeft;
        indices[idx++] = prevRight;
        indices[idx++] = right;

        indices[idx++] = prevLeft;
        indices[idx++] = right;
        indices[idx++] = left;
      }
    }

    // tip vertex at full height
    const tip = rowCount * 2;
    positions[3 * tip + 0] = 0;
    positions[3 * tip + 1] = height;
    positions[3 * tip + 2] = 0;
    uvs[2 * tip + 0] = 0.5;
    uvs[2 * tip + 1] = 1.0;

    // connect last row to tip (single triangle)
    const lastLeft = (rowCount - 1) * 2;
    const lastRight = lastLeft + 1;
    indices[idx++] = lastLeft;
    indices[idx++] = lastRight;
    indices[idx++] = tip;

    // assemble geometry
    const geom = new BufferGeometry();

    const posAttribute = new BufferAttribute(positions, 3);
    posAttribute.setUsage(StaticDrawUsage);
    geom.setAttribute("position", posAttribute);

    const uvAttribute = new BufferAttribute(uvs, 2);
    uvAttribute.setUsage(StaticDrawUsage);
    geom.setAttribute("uv", uvAttribute);

    const indexAttribute = new BufferAttribute(indices, 1);
    indexAttribute.setUsage(StaticDrawUsage);
    geom.setIndex(indexAttribute);

    const normalAttribute = new BufferAttribute(normals, 3);
    normalAttribute.setUsage(StaticDrawUsage);
    geom.setAttribute("normal", normalAttribute);

    return geom;
  }
}
