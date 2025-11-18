import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  LOD,
  Matrix4,
  Sphere,
  StaticDrawUsage,
  Vector2,
  Vector3,
} from "three";
import {
  float,
  floor,
  step,
  abs,
  vec3,
  uniform,
  Fn,
  instancedArray,
  instanceIndex,
  hash,
  texture,
  vec2,
  positionWorld,
  rotate,
  time,
  mix,
  smoothstep,
  clamp,
  vec4,
  positionLocal,
  uv,
  sin,
  min,
  max,
  remap,
  mod,
  If,
  PI2,
  fract,
} from "three/tsl";
import { SpriteNodeMaterial } from "three/webgpu";
import { TSLUtils } from "../../../utils/TSLUtils";
import {
  assetManager,
  rendererManager,
  sceneManager,
  systemState,
  eventsManager,
} from "../../../systems";

const getConfig = () => {
  const BLADE_WIDTH = 0.1;
  const BLADE_HEIGHT = 1.45;
  const TILE_SIZE = 64;
  const BLADES_PER_SIDE = 256;

  const boundingSphereCenter = new Vector3(TILE_SIZE / 2, 0, TILE_SIZE / 2);
  const boundingSphereRadius = TILE_SIZE * 1.5;
  return {
    BLADE_WIDTH,
    BLADE_HEIGHT,
    BLADE_BOUNDING_SPHERE_RADIUS: BLADE_HEIGHT,
    TILE_SIZE,
    TILE_HALF_SIZE: TILE_SIZE / 2,
    TILE_SIZE_SQUARED: TILE_SIZE * TILE_SIZE,
    BLADES_PER_SIDE,
    COUNT: BLADES_PER_SIDE * BLADES_PER_SIDE,
    SPACING: TILE_SIZE / BLADES_PER_SIDE,
    BOUNDING_SPHERE: new Sphere(boundingSphereCenter, boundingSphereRadius),
    WORKGROUP_SIZE: 256,
  };
};

const config = getConfig();

const uniforms = {
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uCameraMatrix: uniform(new Matrix4()),
  uPlayerDeltaXZ: uniform(new Vector2(0, 0)),
  uCameraForward: uniform(new Vector3(0, 0, 0)),
  // Scale
  uBladeMinScale: uniform(0.75),
  uBladeMaxScale: uniform(1.5),
  // Trail
  uTrailGrowthRate: uniform(0.04),
  uTrailMinScale: uniform(0.5),
  uTrailRaius: uniform(1),
  uTrailRaiusSquared: uniform(1),
  uKDown: uniform(0.8),
  // Wind
  uWindStrength: uniform(1.25),
  uWindSpeed: uniform(0.25),
  uvWindScale: uniform(1.75),
  // Color
  uBaseColor: uniform(new Color().setRGB(0.07, 0.07, 0)),
  uTipColor: uniform(new Color().setRGB(0.23, 0.11, 0.05)),
  uAoScale: uniform(1.5),
  uAoRimSmoothness: uniform(5),
  uAoRadius: uniform(20),
  uAoRadiusSquared: uniform(20 * 20),
  uColorMixFactor: uniform(1),
  uColorVariationStrength: uniform(1.6),
  uWindColorStrength: uniform(0.6),
  uBaseWindShade: uniform(0.4),
  uBaseShadeHeight: uniform(1.25),
  // Stochastic keep
  uR0: uniform(45),
  uR1: uniform(75),
  uPMin: uniform(0.1),
  // Rotation
  uBaseBending: uniform(1.25),
};

class GrassSsbo {
  // x -> offsetX (0 unused)
  // y -> offsetZ (0 unused)
  // z -> 0/12 windX - 12/12 windZ (0 unused)
  // w -> 0/8 current scale - 8/8 original scale - 16/1 shadow - 17/1 visibility - 18/4 wind noise factor (0 unused)
  private buffer1: ReturnType<typeof instancedArray>;
  // x -> 0/4 position based noise (20 unused)
  private buffer2: ReturnType<typeof instancedArray>;

  constructor() {
    this.buffer1 = instancedArray(config.COUNT, "vec4");
    this.buffer2 = instancedArray(config.COUNT, "float");
    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
  }

  get computeBuffer1() {
    return this.buffer1;
  }

  get computeBuffer2() {
    return this.buffer2;
  }

  getWind = Fn(([data = vec4(0)]) => {
    const x = TSLUtils.unpackUnits(data.z, 0, 12, -2, 2);
    const z = TSLUtils.unpackUnits(data.z, 12, 12, -2, 2);
    return vec2(x, z);
  });

  getScale = Fn(([data = vec4(0)]) => {
    return TSLUtils.unpackUnits(
      data.w,
      0,
      8,
      uniforms.uTrailMinScale,
      uniforms.uBladeMaxScale,
    );
  });

  getOriginalScale = Fn(([data = vec4(0)]) => {
    return TSLUtils.unpackUnits(
      data.w,
      8,
      8,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
  });

  getShadow = Fn(([data = vec4(0)]) => {
    return TSLUtils.unpackFlag(data.w, 16);
  });

  getVisibility = Fn(([data = vec4(0)]) => {
    return TSLUtils.unpackFlag(data.w, 17);
  });

  getWindNoise = Fn(([data = vec4(0)]) => {
    return TSLUtils.unpackUnit(data.w, 18, 6);
  });

  getPositionNoise = Fn(([data = float(0)]) => {
    return TSLUtils.unpackUnit(data, 0, 4);
  });

  private setWind = Fn(([data = vec4(0), value = vec2(0)]) => {
    data.z = TSLUtils.packUnits(data.z, 0, 12, value.x, -2, 2);
    data.z = TSLUtils.packUnits(data.z, 12, 12, value.y, -2, 2);
    return data;
  });

  private setScale = Fn(([data = vec4(0), value = float(0)]) => {
    data.w = TSLUtils.packUnits(
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
    data.w = TSLUtils.packUnits(
      data.w,
      8,
      8,
      value,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
    return data;
  });

  private setVisibility = Fn(([data = vec4(0), value = float(0)]) => {
    data.w = TSLUtils.packFlag(data.w, 17, value);
    return data;
  });

  private setWindNoise = Fn(([data = vec4(0), value = float(0)]) => {
    data.w = TSLUtils.packUnit(data.w, 18, 6, value);
    return data;
  });

  private setPositionNoise = Fn(([data = float(0), value = float(0)]) => {
    return TSLUtils.packUnit(data, 0, 4, value);
  });

  private computeInit = Fn(() => {
    const data1 = this.buffer1.element(instanceIndex);
    const data2 = this.buffer2.element(instanceIndex);
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
    data1.x = offsetX.add(noiseX);
    data1.y = offsetZ.add(noiseZ);

    data2.assign(this.setPositionNoise(data2, noise.r));
    // Scale
    const n = noise.b;
    const shaped = n.mul(n);
    const randomScale = remap(
      shaped,
      0,
      1,
      uniforms.uBladeMinScale,
      uniforms.uBladeMaxScale,
    );
    data1.assign(this.setScale(data1, randomScale));
    data1.assign(this.setOriginalScale(data1, randomScale));
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

  private computeWind = Fn(
    ([prevWindXZ = vec2(0), worldPos = vec3(0), positionNoise = float(0)]) => {
      const intensity = smoothstep(0.2, 0.5, systemState.wind.uIntensity);
      const dir = systemState.wind.uDirection.negate();
      const strength = uniforms.uWindStrength.add(intensity);

      // --- gentle per-instance speed jitter (±10 %)
      const speed = uniforms.uWindSpeed.mul(
        positionNoise.remap(0, 1, 0.95, 2.05),
      );

      // base uv + scroll
      const uvBase = worldPos.xz.mul(0.01).mul(uniforms.uvWindScale);
      const scroll = dir.mul(speed).mul(time);

      // sample 1 — main noise
      const uvA = uvBase.add(scroll);
      const nA = texture(assetManager.resources.noiseAtlas, uvA)
        .mul(2.0)
        .sub(1.0);

      // sample 2 — same texture, just different frequency & offset
      const uvB = uvBase.mul(1.37).add(scroll.mul(1.11));
      const nB = texture(assetManager.resources.noiseAtlas, uvB)
        .mul(2.0)
        .sub(1.0);

      // mix them — random per instance + slow time wobble
      const mixRand = fract(sin(positionNoise.mul(12.9898)).mul(78.233));
      const mixTime = sin(time.mul(0.4).add(positionNoise.mul(0.1))).mul(0.25);
      const w = clamp(mixRand.add(mixTime), 0.2, 0.8);
      const n = mix(nA, nB, w);

      const baseMag = n.r.mul(strength);
      const gustMag = n.g.mul(strength).mul(0.35);
      const windFactor = baseMag.add(gustMag);

      const target = dir.mul(windFactor);
      const k = mix(0.08, 0.25, abs(n.b)); // smooth damping
      const newWind = prevWindXZ.add(target.sub(prevWindXZ).mul(k));

      return vec3(newWind, windFactor);
    },
  );

  private computeAlpha = Fn(([worldPos = vec3(0)]) => {
    const alphaUv = TSLUtils.computeMapUvByPosition(worldPos.xz);
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
    const _uv = TSLUtils.computeMapUvByPosition(worldPos.xz);
    const shadowAo = texture(
      assetManager.resources.terrainShadowAoTexture,
      _uv,
    );
    return step(0.65, shadowAo.r);
  });

  computeUpdate = Fn(() => {
    const data1 = this.buffer1.element(instanceIndex);

    // Position
    const pos = vec3(data1.x, 0, data1.y);

    const worldPos = pos.add(uniforms.uPlayerPosition);

    // Soft culling
    const data2 = this.buffer2.element(instanceIndex);

    // Compute distance to player
    const diff = worldPos.xz.sub(uniforms.uPlayerPosition.xz);
    const distSq = diff.dot(diff);

    // Check if the player is on the ground
    const isPlayerGrounded = step(
      0.1,
      float(1).sub(uniforms.uPlayerPosition.y),
    );

    const inner = uniforms.uTrailRaiusSquared.mul(0.35);
    const outer = uniforms.uTrailRaiusSquared;
    const contact = float(1.0)
      .sub(smoothstep(inner, outer, distSq))
      .mul(isPlayerGrounded);

    // Trail
    const currentScale = this.getScale(data1);
    const originalScale = this.getOriginalScale(data1);
    const newScale = this.computeTrailScale(
      originalScale,
      currentScale,
      contact,
    );
    data1.assign(this.setScale(data1, newScale));

    // Alpha
    // const alpha = this.computeAlpha(worldPos);
    // data1.assign(this.setVisibility(data1, alpha));

    // Wind
    const positionNoise = this.getPositionNoise(data2);
    const prevWind = this.getWind(data1);
    const newWind = this.computeWind(prevWind, worldPos, positionNoise);
    data1.assign(this.setWind(data1, newWind.xy)); // Wind displacement
    data1.assign(this.setWindNoise(data1, newWind.z)); // Noise factor

    // // Shadow
    // const isShadow = this.computeShadow(worldPos);
    // data.assign(this.setShadow(data, isShadow));
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);
}

class GrassMaterial extends SpriteNodeMaterial {
  uInstanceCellIdx = uniform(0);
  private ssbo: GrassSsbo;
  constructor(ssbo: GrassSsbo) {
    super();
    this.ssbo = ssbo;
    this.createGrassMaterial();
  }

  private createGrassMaterial() {
    this.precision = "lowp";
    this.transparent = false;
    this.alphaTest = 0.9;

    // compute values
    const data1 = this.ssbo.computeBuffer1.element(instanceIndex);
    const data2 = this.ssbo.computeBuffer2.element(instanceIndex);
    const offsetX = data1.x;
    const offsetZ = data1.y;
    const windXZ = this.ssbo.getWind(data1);
    const scaleY = this.ssbo.getScale(data1);
    const isVisible = this.ssbo.getVisibility(data1);
    const windNoiseFactor = this.ssbo.getWindNoise(data1);
    // const isShadow = this.ssbo.getShadow(data);
    const positionNoise = this.ssbo.getPositionNoise(data2);

    // OPACITY
    // this.opacityNode = isVisible;

    // SCALE
    const scaleX = positionNoise.add(0.25);
    const bladeScale = vec3(scaleX, scaleY, 1);
    this.scaleNode = bladeScale;

    // ROTATION
    const h = uv().y;
    const bendProfile = h.mul(h).mul(uniforms.uBaseBending);
    const instanceNoise = hash(instanceIndex.add(196.4356)).sub(0.5).mul(0.25);
    const baseBending = positionNoise
      .sub(0.5)
      .mul(0.25)
      .add(instanceNoise)
      .mul(bendProfile);
    this.rotationNode = vec3(baseBending, 0, 0);

    // POSITION
    // fragment cull
    const offscreenOffset = uniforms.uCameraForward
      .mul(1e6)
      .mul(float(1).sub(isVisible));
    // base offset
    const bladePosition = vec3(offsetX, 0, offsetZ);
    // sway effect
    const randomPhase = positionNoise.mul(PI2);
    const swayAmount = sin(time.mul(5).add(randomPhase)).mul(0.15);
    const swayFactor = uv().y.mul(windNoiseFactor);
    const swayOffset = swayAmount.mul(swayFactor);
    // flutter offset
    const dirXZ = systemState.wind.uDirection;
    const perp = vec2(dirXZ.y.negate(), dirXZ.x);
    const phase = hash(instanceIndex).mul(PI2);
    const flutter = sin(
      time.mul(uniforms.uWindSpeed.mul(1.7)).add(phase.mul(1.3)),
    )
      .mul(0.06)
      .mul(bendProfile);
    const flutterOffset = vec3(perp.x, 0.0, perp.y).mul(flutter);
    // wind offset
    const windOffset = vec3(windXZ.x, 0.0, windXZ.y).mul(bendProfile);

    const pos = bladePosition
      .add(offscreenOffset)
      .add(swayOffset)
      .add(flutterOffset)
      .add(windOffset);
    this.positionNode = pos;

    // COLOR + AO
    // ao
    const r2 = offsetX.mul(offsetX).add(offsetZ.mul(offsetZ));
    const near = float(1).sub(smoothstep(0, uniforms.uAoRadiusSquared, r2));
    const x = uv().x;
    const edge = x.mul(2.0).sub(1.0).abs();
    const rim = smoothstep(
      uniforms.uAoRimSmoothness.negate(),
      uniforms.uAoRimSmoothness,
      edge,
    );
    const hWeight = float(1).sub(smoothstep(0.1, 0.85, h));
    const aoStrength = uniforms.uAoScale.mul(0.25);
    const ao = float(1).sub(aoStrength.mul(near.mul(rim).mul(hWeight)));
    // diffuse
    const colorProfile = h.mul(uniforms.uColorMixFactor).clamp();
    const jitter = positionNoise.mul(uniforms.uColorVariationStrength);
    const baseColorJittered = uniforms.uBaseColor.mul(jitter);
    const baseToTip = mix(baseColorJittered, uniforms.uTipColor, colorProfile);
    const baseMask = float(1).sub(
      smoothstep(0.0, uniforms.uBaseShadeHeight, h),
    );
    const windAo = mix(
      1.0,
      float(1).sub(uniforms.uBaseWindShade),
      baseMask.mul(smoothstep(0.0, 1.0, swayFactor)),
    );
    this.colorNode = baseToTip.mul(windAo).mul(ao);
  }
}

export default class GrassTiles {
  private group = new Group();
  private nGrid = 3;

  constructor() {
    const ssbo = new GrassSsbo();
    const material = new GrassMaterial(ssbo);

    const geometries = [
      this.createGeometry(5),
      this.createGeometry(3),
      this.createGeometry(1),
    ];
    this.group = this.createGrid(material, geometries);
    sceneManager.scene.add(this.group);
    eventsManager.on("engine-update-throttle-2x", ({ player }) => {
      rendererManager.renderer.computeAsync(ssbo.computeUpdate);

      const dx = player.position.x - this.group.position.x;
      const dz = player.position.z - this.group.position.z;
      const distSq = dx * dx + dz * dz;

      uniforms.uPlayerPosition.value.copy(player.position);
      uniforms.uCameraMatrix.value
        .copy(sceneManager.playerCamera.projectionMatrix)
        .multiply(sceneManager.playerCamera.matrixWorldInverse);

      if (distSq < config.TILE_SIZE) return; // don't move if within 1 tile
      this.group.position.x =
        Math.round(player.position.x / config.TILE_SIZE) * config.TILE_SIZE;
      this.group.position.z =
        Math.round(player.position.z / config.TILE_SIZE) * config.TILE_SIZE;
      this.wrapTiles(dx, dz);
    });
  }

  private createGrid(material: GrassMaterial, geometries: BufferGeometry[]) {
    const group = new Group();
    let idx = 0;
    for (let i = 0; i < this.nGrid; i++) {
      for (let j = 0; j < this.nGrid; j++) {
        idx++;
        const x = (i - Math.floor(this.nGrid / 2)) * config.TILE_SIZE;
        const z = (j - Math.floor(this.nGrid / 2)) * config.TILE_SIZE;
        const tile = this.createTile(material, geometries);
        tile.position.set(x, 0, z);
        tile.userData = { idx };

        // // add text geometry label to tile with the incremental index
        // const textGeom = new TextGeometry(`${idx}`, {
        //   font: assetManager.resources.font,
        //   size: 5,
        //   depth: 0.2,
        //   curveSegments: 12,
        //   bevelEnabled: false,
        // });
        // textGeom.center();
        // textGeom.rotateX(-Math.PI / 2);
        // textGeom.translate(0, 0.2, 0);
        // const textMaterial = new MeshBasicMaterial({ color: "white" });
        // const textMesh = new Mesh(textGeom, textMaterial);
        // tile.add(textMesh);

        group.add(tile);
      }
    }
    return group;
  }

  private wrapTiles(dx: number, dz: number) {
    // move tiles opposite to player movement and wrap around
    this.group.children.forEach((tile) => {
      tile.position.x -= config.TILE_SIZE * Math.sign(dx);
      tile.position.z -= config.TILE_SIZE * Math.sign(dz);
      if (Math.abs(tile.position.x) > (this.nGrid / 2) * config.TILE_SIZE) {
        tile.position.x -=
          Math.sign(tile.position.x) * this.nGrid * config.TILE_SIZE;
      }
      if (Math.abs(tile.position.z) > (this.nGrid / 2) * config.TILE_SIZE) {
        tile.position.z -=
          Math.sign(tile.position.z) * this.nGrid * config.TILE_SIZE;
      }
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
    return geom;
  }

  private createTile(material: GrassMaterial, geometries: BufferGeometry[]) {
    const lod = new LOD();
    const meshHigh = new InstancedMesh(geometries[0], material, config.COUNT);
    meshHigh.boundingSphere = config.BOUNDING_SPHERE;
    lod.addLevel(meshHigh, 0);
    const meshMid = new InstancedMesh(geometries[1], material, config.COUNT);
    meshMid.boundingSphere = config.BOUNDING_SPHERE;
    lod.addLevel(meshMid, 50);
    const meshLow = new InstancedMesh(geometries[2], material, config.COUNT);
    meshLow.boundingSphere = config.BOUNDING_SPHERE;
    lod.addLevel(meshLow, 100);
    return lod;
  }
}
