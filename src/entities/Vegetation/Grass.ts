import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
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
  positionLocal,
  float,
  floor,
  rotate,
  vec3,
  vec4,
  smoothstep,
  vec2,
  texture,
  step,
  min,
  sin,
  abs,
  max,
  clamp,
  If,
  Discard,
  mod,
  time,
  PI2,
} from "three/tsl";
import { assetManager } from "../../systems/AssetManager";
import { debugManager } from "../../systems/DebugManager";
import { rendererManager } from "../../systems/RendererManager";
import { sceneManager } from "../../systems/SceneManager";
import { eventsManager } from "../../systems/EventsManager";
import { tslUtils } from "../../utils/TSLUtils";
import { MeshBasicNodeMaterial } from "three/webgpu";

const getConfig = () => {
  const BLADE_WIDTH = 0.1;
  const BLADE_HEIGHT = 1.65;
  const TILE_SIZE = 150;
  const BLADES_PER_SIDE = 512; // power of 2
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
  // Scale
  uBladeMinScale: uniform(0.5),
  uBladeMaxScale: uniform(1.25),
  // Trail
  uTrailGrowthRate: uniform(0.004),
  uTrailMinScale: uniform(0.25),
  uTrailRaius: uniform(0.65),
  uTrailRaiusSquared: uniform(0.65 * 0.65),
  // Glow
  uGlowRadius: uniform(2),
  uGlowRadiusSquared: uniform(4),
  uGlowFadeIn: uniform(0.05),
  uGlowFadeOut: uniform(0.01),
  uGlowColor: uniform(new Color().setRGB(0.39, 0.14, 0.02)),
  // Bending
  uBladeMaxBendAngle: uniform(Math.PI * 0.15),
  uWindStrength: uniform(0.6),
  // Color
  uBaseColor: uniform(new Color().setRGB(0.07, 0.07, 0)), // Light
  uTipColor: uniform(new Color().setRGB(0.23, 0.11, 0.05)), // Light
  // uBaseColor: uniform(new Color().setRGB(0.0, 0.01, 0.01)), // Dark
  // uTipColor: uniform(new Color().setRGB(0.0, 0.11, 0.06)), // Dark
  // Updated externally
  uDelta: uniform(new Vector2(0, 0)),
  uGlowMul: uniform(3),

  uR0: uniform(20),
  uR1: uniform(75),
  uPMin: uniform(0.05),

  uWindSpeed: uniform(0.25),
};

class GrassSsbo {
  // x -> offsetX (0 unused)
  // y -> offsetZ (0 unused)
  // z -> 0/12 yaw - 12/12 bend (0 unused)
  // w -> 0/8 current scale - 8/8 original scale - 16/1 shadow - 17/1 visibility - 18/4 glow factor (0 unused)
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

  getYaw = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackUnits(data.z, 0, 12, -Math.PI, Math.PI);
  });

  getBend = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackUnits(data.z, 12, 12, -Math.PI, Math.PI);
  });

  getScale = Fn(([data = vec4(0)]) => {
    return tslUtils.unpackUnits(
      data.w,
      0,
      8,
      uniforms.uBladeMinScale,
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

  private setYaw = Fn(([data = vec4(0), value = float(0)]) => {
    data.z = tslUtils.packUnits(data.z, 0, 12, value, -Math.PI, Math.PI);
    return data;
  });

  private setBend = Fn(([data = vec4(0), value = float(0)]) => {
    data.z = tslUtils.packUnits(data.z, 12, 12, value, -Math.PI, Math.PI);
    return data;
  });

  private setScale = Fn(([data = vec4(0), value = float(0)]) => {
    data.w = tslUtils.packUnits(
      data.w,
      0,
      8,
      value,
      uniforms.uBladeMinScale,
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
      .abs();

    const noise = texture(assetManager.noiseTexture, _uv);
    const noiseX = noise.r.sub(0.5).mul(17).fract();
    const noiseZ = noise.b.sub(0.5).mul(13).fract();

    data.x = offsetX.add(noiseX);
    data.y = offsetZ.add(noiseZ);

    // Yaw
    const yaw = noise.b.sub(0.5).mul(float(Math.PI * 2)); // Map noise to [-PI, PI]
    data.assign(this.setYaw(data, yaw));

    // Scale
    const scaleRange = uniforms.uBladeMaxScale.sub(uniforms.uBladeMinScale);
    const randomScale = noise.r.mul(scaleRange).add(uniforms.uBladeMinScale);

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

  private computeBending = Fn(
    ([prevBending = float(0), worldPos = vec3(0)]) => {
      const windUV = worldPos.xz
        .add(time.mul(uniforms.uWindSpeed))
        .mul(0.5)
        .fract();

      const windStrength = texture(assetManager.noiseTexture, windUV, 2).r;

      const targetBendAngle = windStrength.mul(uniforms.uWindStrength);

      return prevBending.add(targetBendAngle.sub(prevBending).mul(0.1));
    },
  );

  private computeAlpha = Fn(([worldPos = vec3(0)]) => {
    const alphaUv = tslUtils.computeMapUvByPosition(worldPos.xz);
    const alpha = texture(assetManager.terrainTypeMap, alphaUv).g;
    const threshold = step(0.25, alpha);
    return threshold;
  });

  private computeTrailScale = Fn(
    ([
      originalScale = float(0),
      currentScale = float(0),
      isBladeSteppedOn = float(0),
    ]) => {
      const growScale = currentScale.add(uniforms.uTrailGrowthRate);

      const growScaleFactor = float(1).sub(isBladeSteppedOn);
      const targetScale = uniforms.uTrailMinScale
        .mul(isBladeSteppedOn)
        .add(growScale.mul(growScaleFactor));

      return min(targetScale, originalScale);
    },
  );

  private computeTrailGlow = Fn(
    ([
      prevGlow = float(0),
      distSq = float(0),
      isBladeSteppedOn = float(0),
      isPlayerGrounded = float(0),
    ]) => {
      const glowRadiusFactor = smoothstep(
        uniforms.uGlowRadiusSquared, // Outer radius (low intensity)
        float(0), // Inner radius (high intensity)
        distSq, // Distance squared to player
      );
      // Check if the player is moving (prevents constant glow when stationary)
      const precision = 100.0;
      const absDeltaX = floor(abs(uniforms.uDelta.x).mul(precision));
      const absDeltaZ = floor(abs(uniforms.uDelta.y).mul(precision));
      // Step function correctly returns 1 if sum > 0, else 0
      const isPlayerMoving = step(1.0, absDeltaX.add(absDeltaZ));
      // Base glow factor (only applies if within radius, not squished, and player grounded)
      const baseGlowFactor = glowRadiusFactor
        .mul(float(1).sub(isBladeSteppedOn))
        .mul(isPlayerGrounded);
      // If moving or glow was already active, apply glow effect
      const isBladeAffected = max(isPlayerMoving, prevGlow).mul(baseGlowFactor);
      // Compute fade-in when affected, fade-out when not affected
      const fadeIn = isBladeAffected.mul(uniforms.uGlowFadeIn);
      const fadeOut = float(1).sub(isBladeAffected).mul(uniforms.uGlowFadeOut);
      // Force fade-out when **fully stationary**
      const forceFadeOut = float(1)
        .sub(isPlayerMoving)
        .mul(uniforms.uGlowFadeOut)
        .mul(prevGlow);
      // Apply glow effect and ensure full fade-out when stationary
      return clamp(
        prevGlow.add(fadeIn).sub(fadeOut).sub(forceFadeOut),
        0.0,
        1.0,
      );
    },
  );

  private computeShadow = Fn(([worldPos = vec3(0)]) => {
    const _uv = tslUtils.computeMapUvByPosition(worldPos.xz);
    const shadowAo = texture(assetManager.terrainShadowAo, _uv);
    return step(0.65, shadowAo.r);
  });

  computeUpdate = Fn(() => {
    const data = this.buffer.element(instanceIndex);

    // Position
    const newOffsetX = mod(
      data.x.sub(uniforms.uDelta.x).add(config.TILE_HALF_SIZE),
      config.TILE_SIZE,
    ).sub(config.TILE_HALF_SIZE);

    const newOffsetZ = mod(
      data.y.sub(uniforms.uDelta.y).add(config.TILE_HALF_SIZE),
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
      const playerPos = vec2(uniforms.uDelta.x, uniforms.uDelta.y);
      const diff = pos.xz.sub(playerPos);
      const distSq = diff.dot(diff);

      // Check if the player is on the ground
      const isPlayerGrounded = step(
        0.1,
        float(1).sub(uniforms.uPlayerPosition.y),
      ); // 1 if grounded, 0 if airborne

      const isBladeSteppedOn = step(distSq, uniforms.uTrailRaiusSquared).mul(
        isPlayerGrounded,
      ); // 1 if stepped on, 0 if not

      // Trail
      const currentScale = this.getScale(data);
      const originalScale = this.getOriginalScale(data);
      const newScale = this.computeTrailScale(
        originalScale,
        currentScale,
        isBladeSteppedOn,
      );
      data.assign(this.setScale(data, newScale));

      // Alpha
      const alpha = this.computeAlpha(worldPos);
      data.assign(this.setVisibility(data, alpha));

      // Wind
      const prevBending = this.getBend(data);
      const newBending = this.computeBending(prevBending, worldPos);
      data.assign(this.setBend(data, newBending));

      // Glow
      const prevGlow = this.getGlow(data);
      const newGlow = this.computeTrailGlow(
        prevGlow,
        distSq,
        isBladeSteppedOn,
        isPlayerGrounded,
      );

      data.assign(this.setGlow(data, newGlow));

      // Shadow
      const isShadow = this.computeShadow(worldPos);
      data.assign(this.setShadow(data, isShadow));
    });
  })().compute(config.COUNT, [config.WORKGROUP_SIZE]);
}

class GrassMaterial extends MeshBasicNodeMaterial {
  private ssbo: GrassSsbo;
  constructor(ssbo: GrassSsbo) {
    super();
    this.ssbo = ssbo;
    this.createGrassMaterial();
  }

  private computePosition = Fn(
    ([
      offsetX = float(0),
      offsetZ = float(0),
      yawAngle = float(0),
      bendingAngle = float(0),
      scale = float(0),
      glowFactor = float(0),
    ]) => {
      const offset = vec3(offsetX, 0, offsetZ);
      const bendAmount = bendingAngle.mul(uv().y);
      const bentPosition = rotate(positionLocal, vec3(bendAmount, 0, 0));
      const scaled = bentPosition.mul(vec3(1, scale, 1));
      const rotated = rotate(scaled, vec3(0, yawAngle, 0));
      const randomPhase = hash(instanceIndex).mul(PI2); // Random phase in range [0, 2π]
      const swayAmount = sin(
        time.mul(5).add(bendingAngle).add(randomPhase),
      ).mul(0.1);
      const swayFactor = uv().y.mul(glowFactor);
      const swayOffset = swayAmount.mul(swayFactor);
      const worldPosition = rotated.add(offset).add(vec3(swayOffset));
      return worldPosition;
    },
  );

  private computeDiffuseColor = Fn(
    ([glowFactor = float(0), isShadow = float(1)]) => {
      const baseToTip = mix(uniforms.uBaseColor, uniforms.uTipColor, uv().y);

      const withGlow = mix(
        baseToTip,
        uniforms.uGlowColor.mul(uniforms.uGlowMul),
        glowFactor,
      );

      const withShadow = mix(withGlow.mul(0.5), withGlow, isShadow);

      return withShadow;
    },
  );

  private createGrassMaterial() {
    this.precision = "lowp";
    this.side = DoubleSide;
    const data = this.ssbo.computeBuffer.element(instanceIndex);

    const offsetX = data.x;
    const offsetZ = data.y;
    const yawAngle = this.ssbo.getYaw(data);
    const bendingAngle = this.ssbo.getBend(data);
    const scale = this.ssbo.getScale(data);
    const isVisible = this.ssbo.getVisibility(data);
    const glowFactor = this.ssbo.getGlow(data);
    const isShadow = this.ssbo.getShadow(data);

    Discard(isVisible.equal(0));
    this.positionNode = this.computePosition(
      offsetX,
      offsetZ,
      yawAngle,
      bendingAngle,
      scale,
      glowFactor,
    );
    this.opacityNode = isVisible;
    this.alphaTest = 0.5;
    this.colorNode = this.computeDiffuseColor(glowFactor, isShadow);
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
      uniforms.uDelta.value.set(dx, dz);
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
      expanded: false,
    });
    folder.addBinding(uniforms.uTipColor, "value", {
      label: "Tip Color",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.uBaseColor, "value", {
      label: "Base Color",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.uGlowColor, "value", {
      label: "Glow Color",
      view: "color",
      color: { type: "float" },
    });
    folder.addBinding(uniforms.uWindStrength, "value", {
      label: "Wind strength",
      min: 0,
      max: Math.PI / 2,
      step: 0.1,
    });
    folder.addBinding(uniforms.uWindSpeed, "value", {
      label: "Wind speed",
      min: 0,
      max: 5,
      step: 0.01,
    });

    folder.addBinding(uniforms.uGlowMul, "value", {
      label: "Glow bloom",
      min: 1,
      max: 20,
      step: 0.01,
    });

    folder.addBinding(uniforms.uR0, "value", {
      label: "Inner ring",
      min: 0,
      max: config.TILE_SIZE,
      step: 0.1,
    });
    folder.addBinding(uniforms.uR1, "value", {
      label: "Outer ring",
      min: 0,
      max: config.TILE_SIZE,
      step: 0.1,
    });
    folder.addBinding(uniforms.uPMin, "value", {
      label: "P Min",
      min: 0,
      max: 1,
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
