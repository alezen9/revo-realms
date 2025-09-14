import {
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedBufferGeometry,
  Matrix4,
  Mesh,
  StaticDrawUsage,
  Vector2,
  Vector3,
} from "three";
import { State } from "../../Game";
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
  fract,
  color,
  pow,
} from "three/tsl";
import {
  MeshBasicNodeMaterial,
  // IndirectStorageBufferAttribute,
} from "three/webgpu";
import { assetManager } from "../../systems/AssetManager";
import { debugManager } from "../../systems/DebugManager";
import { rendererManager } from "../../systems/RendererManager";
import { sceneManager } from "../../systems/SceneManager";
import { eventsManager } from "../../systems/EventsManager";
import { UniformType } from "../../types";
import { tslUtils } from "../../utils/TSLUtils";

const getConfig = () => {
  const BLADE_WIDTH = 0.075;
  const BLADE_HEIGHT = 1.45;
  const TILE_SIZE = 150;
  const BLADES_PER_SIDE = 500;
  return {
    BLADE_WIDTH,
    BLADE_HEIGHT,
    BLADE_BOUNDING_SPHERE_RADIUS: BLADE_HEIGHT,
    TILE_SIZE,
    TILE_HALF_SIZE: TILE_SIZE / 2,
    BLADES_PER_SIDE,
    COUNT: BLADES_PER_SIDE * BLADES_PER_SIDE,
    SPACING: TILE_SIZE / BLADES_PER_SIDE,
  };
};
const grassConfig = getConfig();

type GrassUniforms = {
  uPlayerPosition?: UniformType<Vector3>;
  uCameraMatrix?: UniformType<Matrix4>;
  // Scale
  uBladeMinScale?: UniformType<number>;
  uBladeMaxScale?: UniformType<number>;
  // Trail
  uTrailGrowthRate?: UniformType<number>;
  uTrailMinScale?: UniformType<number>;
  uTrailRaius?: UniformType<number>;
  uTrailRaiusSquared?: UniformType<number>;
  // Glow
  uGlowRadius?: UniformType<number>;
  uGlowRadiusSquared?: UniformType<number>;
  uGlowFadeIn?: UniformType<number>;
  uGlowFadeOut?: UniformType<number>;
  uGlowColor?: UniformType<Color>;
  // Bending
  uBladeMaxBendAngle?: UniformType<number>;
  uWindStrength?: UniformType<number>;
  // Color
  uBaseColor?: UniformType<Color>;
  uTipColor?: UniformType<Color>;
  // Updated externally
  uDelta: UniformType<Vector2>;
};

const defaultUniforms: Required<GrassUniforms> = {
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
  uGlowColor: uniform(new Color().setRGB(0.55, 0.21, 0.05)),
  // Bending
  uBladeMaxBendAngle: uniform(Math.PI * 0.15),
  uWindStrength: uniform(0.6),
  // Color
  uBaseColor: uniform(new Color().setRGB(0.07, 0.07, 0)),
  uTipColor: uniform(new Color().setRGB(0.4, 0.2, 0.09)),
  // Updated externally
  uDelta: uniform(new Vector2(0, 0)),
};

class GrassMaterial extends MeshBasicNodeMaterial {
  _uniforms: Required<GrassUniforms>;
  private _buffer: ReturnType<typeof instancedArray>; // holds: vec4 = (localOffset.x, localOffset.y, [yaw (4), bending angle (13), alpha (1), glow (6)], [current scale (8), original scale (8), shadow (1)])

  constructor(uniforms?: GrassUniforms) {
    super();
    this._uniforms = { ...defaultUniforms, ...uniforms };
    this._buffer = instancedArray(grassConfig.COUNT, "vec4");
    this._buffer.setPBO(true);

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
    this.createGrassMaterial();
  }

  private computeInit = Fn(() => {
    const data = this._buffer.element(instanceIndex);

    // Position XZ
    const row = floor(float(instanceIndex).div(grassConfig.BLADES_PER_SIDE));
    const col = float(instanceIndex).mod(grassConfig.BLADES_PER_SIDE);

    const randX = hash(instanceIndex.add(4321));
    const randZ = hash(instanceIndex.add(1234));

    const offsetX = col
      .mul(grassConfig.SPACING)
      .sub(grassConfig.TILE_HALF_SIZE)
      .add(randX.mul(grassConfig.SPACING * 0.5));
    const offsetZ = row
      .mul(grassConfig.SPACING)
      .sub(grassConfig.TILE_HALF_SIZE)
      .add(randZ.mul(grassConfig.SPACING * 0.5));

    const _uv = vec3(offsetX, 0, offsetZ)
      .xz.add(grassConfig.TILE_HALF_SIZE)
      .div(grassConfig.TILE_SIZE)
      .abs();

    const noise = texture(assetManager.noiseTexture, _uv);
    const noiseX = noise.b.sub(0.5).mul(17);
    const noiseZ = noise.b.sub(0.5).mul(13);

    data.x = offsetX.add(noiseX);
    data.y = offsetZ.add(noiseZ);

    // Yaw
    const yawVariation = noise.b.sub(0.5).mul(float(Math.PI * 2)); // Map noise to [-PI, PI]

    data.z = tslUtils.packUnits(data.z, 0, 4, yawVariation, -Math.PI, Math.PI);

    // Scale
    const scaleRange = this._uniforms.uBladeMaxScale.sub(
      this._uniforms.uBladeMinScale,
    );
    const randomScale = hash(instanceIndex.add(958.32))
      .mul(scaleRange)
      .add(this._uniforms.uBladeMinScale);

    data.w = tslUtils.packUnits(
      data.w,
      0,
      8,
      randomScale,
      this._uniforms.uBladeMinScale,
      this._uniforms.uBladeMaxScale,
    );

    data.w = tslUtils.packUnits(
      data.w,
      8,
      8,
      randomScale,
      this._uniforms.uBladeMinScale,
      this._uniforms.uBladeMaxScale,
    );
  })().compute(grassConfig.COUNT);

  // Cheap 1D and 2D hashes (Inigo Quilez style)
  private hash12 = Fn(([p = vec2(0)]) => {
    const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031));
    const n = p3.dot(p3.yzx.add(33.33)); // float
    const p3b = p3.add(n); // broadcast add
    const v = p3b.x.add(p3b.y); // float
    return fract(v.mul(p3b.z)); // float in [0,1)
  });

  private hash11 = Fn(([x = float(0)]) => {
    // just hash12 on a made-up 2D from x
    return this.hash12(vec2(x, x.mul(0.5).add(11.1)));
  });

  private computeVisibility = Fn(([worldPos = vec3(0)]) => {
    // ---- Frustum ----
    const clipPos = this._uniforms.uCameraMatrix.mul(vec4(worldPos, 1.0));
    const ndc = clipPos.xyz.div(clipPos.w);
    const one = float(1.0);
    const rNDC = grassConfig.BLADE_BOUNDING_SPHERE_RADIUS;
    const inFrustum = step(one.negate().sub(rNDC), ndc.x)
      .mul(step(ndc.x, one.add(rNDC)))
      .mul(step(one.negate().sub(rNDC), ndc.y))
      .mul(step(ndc.y, one.add(rNDC)))
      .mul(step(0.0, ndc.z))
      .mul(step(ndc.z, one));

    // ---- World distance^2 from player ----
    const dx = worldPos.x.sub(this._uniforms.uPlayerPosition.x);
    const dz = worldPos.z.sub(this._uniforms.uPlayerPosition.z);
    const distSq = dx.mul(dx).add(dz.mul(dz));

    // ---- Radii & params ----
    const R0 = float(grassConfig.TILE_HALF_SIZE * 0.25); // inner full-density radius
    const R1 = float(grassConfig.TILE_HALF_SIZE * 1); // outer min-density radius
    const pMin = float(0.15); // far-field keep

    // ---- Coarse cell (decorrelate across screen/world) ----
    const cellSize = float(max(0.25, grassConfig.SPACING * 1.0));
    const cx = floor(worldPos.x.div(cellSize));
    const cz = floor(worldPos.z.div(cellSize));
    const cellHash = this.hash12(vec2(cx, cz)); // 0..1 float

    // ---- Per-instance jitter (meters), mixed with cellHash ----
    const jMeters = float(2.0);
    const jInst = this.hash11(float(instanceIndex)).mul(2.0).sub(1.0); // -1..1
    const jMix = jInst.mul(0.7).add(cellHash.mul(0.3)); // -1..1
    const j = jMix.mul(jMeters); // meters

    // Approximate (R + j)^2 ≈ R^2 + 2*R*j (drop j^2)
    const R0SqJ = R0.mul(R0).add(R0.mul(j).mul(2.0));
    const R1SqJ = R1.mul(R1).add(R1.mul(j).mul(2.0));
    const lo = min(R0SqJ, R1SqJ);
    const hi = max(R0SqJ, R1SqJ);

    // ---- Gentle ramp: linear then cubic ease (no reassignment) ----
    const tLin = clamp(distSq.sub(lo).div(max(hi.sub(lo), 1e-5)), 0.0, 1.0);
    const t = tLin.mul(tLin).mul(tLin); // cubic ease-in

    // ---- Probability ----
    const p = mix(1.0, pMin, t);

    // ---- Deterministic RNG using instance + cell ----
    const rnd = this.hash12(
      vec2(float(instanceIndex).mul(0.618), cellHash.mul(1.37)),
    );

    // ---- Final keep ----
    const keepInside = step(rnd, p); // 0/1
    return inFrustum.mul(keepInside); // 0/1
  });

  private computeBending = Fn(
    ([prevBending = float(0), worldPos = vec3(0)]) => {
      const windUV = worldPos.xz.add(time.mul(0.25)).mul(0.5).fract();

      const windStrength = texture(assetManager.noiseTexture, windUV, 2).r;

      const targetBendAngle = windStrength.mul(this._uniforms.uWindStrength);

      return prevBending.add(targetBendAngle.sub(prevBending).mul(0.1));
    },
  );

  private computeAlpha = Fn(([worldPos = vec3(0)]) => {
    const alphaUv = tslUtils.computeMapUvByPosition(worldPos.xz);
    const alpha = texture(assetManager.terrainTypeMap, alphaUv).g;
    const threshold = step(0.25, alpha);
    return alpha.mul(threshold);
  });

  private computeTrailScale = Fn(
    ([
      originalScale = float(0),
      currentScale = float(0),
      isBladeSteppedOn = float(0),
    ]) => {
      const growScale = originalScale.add(this._uniforms.uTrailGrowthRate);

      const growScaleFactor = float(1).sub(isBladeSteppedOn);
      const targetScale = this._uniforms.uTrailMinScale
        .mul(isBladeSteppedOn)
        .add(growScale.mul(growScaleFactor));

      return min(targetScale, currentScale);
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
        this._uniforms.uGlowRadiusSquared, // Outer radius (low intensity)
        float(0), // Inner radius (high intensity)
        distSq, // Distance squared to player
      );

      // Check if the player is moving (prevents constant glow when stationary)
      const precision = 100.0;
      const absDeltaX = floor(abs(this._uniforms.uDelta.x).mul(precision));
      const absDeltaZ = floor(abs(this._uniforms.uDelta.y).mul(precision));

      // Step function correctly returns 1 if sum > 0, else 0
      const isPlayerMoving = step(1.0, absDeltaX.add(absDeltaZ));

      // Base glow factor (only applies if within radius, not squished, and player grounded)
      const baseGlowFactor = glowRadiusFactor
        .mul(float(1).sub(isBladeSteppedOn))
        .mul(isPlayerGrounded);

      // If moving or glow was already active, apply glow effect
      const isBladeAffected = max(isPlayerMoving, prevGlow).mul(baseGlowFactor);

      // Compute fade-in when affected, fade-out when not affected
      const fadeIn = isBladeAffected.mul(this._uniforms.uGlowFadeIn);
      const fadeOut = float(1)
        .sub(isBladeAffected)
        .mul(this._uniforms.uGlowFadeOut);

      // Force fade-out when **fully stationary**
      const forceFadeOut = float(1)
        .sub(isPlayerMoving)
        .mul(this._uniforms.uGlowFadeOut)
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

  private computeUpdate = Fn(() => {
    const data = this._buffer.element(instanceIndex);

    // Position
    const newOffsetX = mod(
      data.x.sub(this._uniforms.uDelta.x).add(grassConfig.TILE_HALF_SIZE),
      grassConfig.TILE_SIZE,
    ).sub(grassConfig.TILE_HALF_SIZE);

    const newOffsetZ = mod(
      data.y.sub(this._uniforms.uDelta.y).add(grassConfig.TILE_HALF_SIZE),
      grassConfig.TILE_SIZE,
    ).sub(grassConfig.TILE_HALF_SIZE);
    const pos = vec3(newOffsetX, 0, newOffsetZ);

    data.x = newOffsetX;
    data.y = newOffsetZ;

    const worldPos = pos.add(this._uniforms.uPlayerPosition);

    // Visibility
    const isVisible = this.computeVisibility(worldPos);
    data.z = tslUtils.packFlag(data.z, 17, isVisible);

    // Soft culling
    If(isVisible, () => {
      // Compute distance to player
      const playerPos = vec2(this._uniforms.uDelta.x, this._uniforms.uDelta.y);
      const diff = pos.xz.sub(playerPos);
      const distSq = diff.dot(diff);

      // Check if the player is on the ground
      const isPlayerGrounded = step(
        0.1,
        float(1).sub(this._uniforms.uPlayerPosition.y),
      ); // 1 if grounded, 0 if airborne

      const isBladeSteppedOn = step(
        distSq,
        this._uniforms.uTrailRaiusSquared,
      ).mul(isPlayerGrounded); // 1 if stepped on, 0 if not

      // Trail
      const originalScale = tslUtils.unpackUnits(
        data.w,
        0,
        8,
        this._uniforms.uBladeMinScale,
        this._uniforms.uBladeMaxScale,
      );
      const currentScale = tslUtils.unpackUnits(
        data.w,
        8,
        8,
        this._uniforms.uBladeMinScale,
        this._uniforms.uBladeMaxScale,
      );
      const newScale = this.computeTrailScale(
        originalScale,
        currentScale,
        isBladeSteppedOn,
      );
      data.w = tslUtils.packUnits(
        data.w,
        8,
        8,
        newScale,
        this._uniforms.uBladeMinScale,
        this._uniforms.uBladeMaxScale,
      );
      // Alpha
      const alpha = this.computeAlpha(worldPos);
      data.z = tslUtils.packFlag(data.z, 17, alpha);
      // Wind
      const prevBending = tslUtils.unpackUnits(
        data.z,
        4,
        13,
        -Math.PI,
        Math.PI,
      );
      const newBending = this.computeBending(prevBending, worldPos);
      data.z = tslUtils.packUnits(data.z, 4, 13, newBending, -Math.PI, Math.PI);
      // Glow
      const prevGlow = tslUtils.unpackUnit(data.z, 18, 6);
      const newGlow = this.computeTrailGlow(
        prevGlow,
        distSq,
        isBladeSteppedOn,
        isPlayerGrounded,
      );

      data.z = tslUtils.packUnit(data.z, 18, 6, newGlow);

      // Shadow
      const isShadow = this.computeShadow(worldPos);
      data.w = tslUtils.packFlag(data.w, 18, isShadow);
    });
  })().compute(grassConfig.COUNT);

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

      const randomPhase = hash(instanceIndex).mul(6.28); // Random phase in range [0, 2π]
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
      const verticalFactor = uv().y;
      const baseToTip = mix(
        this._uniforms.uBaseColor,
        this._uniforms.uTipColor,
        verticalFactor,
      );

      const tint = hash(instanceIndex.add(1000)).mul(0.03).add(0.985);
      const variedColor = baseToTip.mul(tint).clamp();

      const finalColor = mix(
        variedColor,
        this._uniforms.uGlowColor.mul(0.5),
        glowFactor,
      );

      const diff = mix(finalColor.mul(0.5), finalColor, isShadow);

      return diff;
    },
  );

  private computeAO = Fn(() => {
    const uvX = uv().x;
    const uvY = uv().y;

    const instanceBias = hash(instanceIndex).mul(0.5).sub(0.05);
    const sideFactor = smoothstep(0, 1.2, abs(uvX.add(instanceBias)));

    const baseFactor = smoothstep(0, 0.6, uvY.negate());

    const midFactor = smoothstep(0.3, 0.6, uvY).mul(0.1);

    const combined = baseFactor.add(sideFactor).add(midFactor).mul(0.75);

    const ao = float(1.0).sub(combined);

    return ao.mul(1.2);
  });

  private createGrassMaterial() {
    this.precision = "lowp";
    this.side = DoubleSide;
    const data = this._buffer.element(instanceIndex);

    const offsetX = data.x;
    const offsetZ = data.y;

    const yawAngle = tslUtils.unpackUnits(data.z, 0, 4, -Math.PI, Math.PI);
    const bendingAngle = tslUtils.unpackUnits(data.z, 4, 13, -Math.PI, Math.PI);
    const scale = tslUtils.unpackUnits(
      data.w,
      8,
      8,
      this._uniforms.uBladeMinScale,
      this._uniforms.uBladeMaxScale,
    );
    const isVisible = tslUtils.unpackFlag(data.z, 17);
    const glowFactor = tslUtils.unpackUnit(data.z, 18, 6);
    const isShadow = tslUtils.unpackFlag(data.w, 18);

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
    this.aoNode = this.computeAO();
    // const c1 = this.computeDiffuseColor(glowFactor, isShadow).mul(isVisible);
    // const c2 = color("red").mul(float(1).sub(isVisible));
    // this.colorNode = c1.add(c2);
    this.colorNode = this.computeDiffuseColor(glowFactor, isShadow);
  }

  async updateAsync() {
    rendererManager.renderer.computeAsync(this.computeUpdate);
  }
}

export default class Grass {
  private material: GrassMaterial;
  private grassField: Mesh;
  private uniforms = {
    ...defaultUniforms,
    uDelta: uniform(new Vector2(0, 0)),
    uPlayerPosition: uniform(new Vector3(0, 0, 0)),
    uCameraMatrix: uniform(new Matrix4()),
  };

  constructor() {
    const geometry = this.createBladeGeometry();
    geometry.instanceCount = grassConfig.COUNT;
    // const uint32 = new Uint32Array(5);
    // uint32[0] = geometry.index!.count;
    // uint32[1] = grassConfig.COUNT; // instance count
    // uint32[2] = 0;
    // uint32[3] = 0;
    // uint32[4] = 0;
    // const drawBuffer = new IndirectStorageBufferAttribute(uint32, 5);
    // geometry.setIndirect(drawBuffer);

    this.material = new GrassMaterial(this.uniforms);
    this.grassField = new Mesh(geometry, this.material);
    sceneManager.scene.add(this.grassField);

    eventsManager.on("update-throttle-4x", this.updateAsync.bind(this));

    this.debugGrass();
  }

  private debugGrass() {
    const grassFolder = debugManager.panel.addFolder({ title: "🌱 Grass" });
    grassFolder.expanded = false;
    grassFolder.addBinding(this.uniforms.uTipColor, "value", {
      label: "Tip Color",
      view: "color",
      color: { type: "float" },
    });
    grassFolder.addBinding(this.uniforms.uBaseColor, "value", {
      label: "Base Color",
      view: "color",
      color: { type: "float" },
    });
    grassFolder.addBinding(this.uniforms.uGlowColor, "value", {
      label: "Glow Color",
      view: "color",
      color: { type: "float" },
    });
    grassFolder.addBinding(this.uniforms.uWindStrength, "value", {
      label: "Wind strength",
      min: 0,
      max: Math.PI / 2,
      step: 0.1,
    });
  }

  private createBladeGeometry() {
    //    G
    //   / \
    //  F---F'
    // /     \
    // C-------D
    // |   \   |
    // A-------B

    const halfWidth = grassConfig.BLADE_WIDTH / 2;
    const quarterWidth = halfWidth / 2;
    const segmentHeight = grassConfig.BLADE_HEIGHT / 4;

    const positions = new Float32Array([
      // A, B
      -halfWidth,
      0,
      0,
      halfWidth,
      0,
      0,
      // C, D
      -quarterWidth * 1.25,
      segmentHeight * 1,
      0,
      quarterWidth * 1.25,
      segmentHeight * 1,
      0,
      // F, F'
      -quarterWidth * 0.75,
      segmentHeight * 2,
      0,
      quarterWidth * 0.75,
      segmentHeight * 2,
      0,
      // G (tip)
      0,
      segmentHeight * 3,
      0,
    ]);

    const uvs = new Float32Array([
      // A, B
      0,
      0,
      1,
      0,
      // C, D
      0.25,
      segmentHeight * 1,
      0.75,
      segmentHeight * 1,
      // F, F'
      0.375,
      segmentHeight * 2,
      0.625,
      segmentHeight * 2,
      // G
      0.5,
      segmentHeight * 3,
    ]);

    const indices = new Uint8Array([
      // A-B-D, A-D-C
      0, 1, 3, 0, 3, 2,
      // C-D-F', C-F'-F
      2, 3, 5, 2, 5, 4,
      // F-F'-G
      4, 5, 6,
    ]);

    // Angles per segment
    const angle1 = (25 * Math.PI) / 180;
    const angle2 = (15 * Math.PI) / 180;
    const angle3 = (8 * Math.PI) / 180;

    const cos1 = Math.cos(angle1);
    const sin1 = Math.sin(angle1);

    const cos2 = Math.cos(angle2);
    const sin2 = Math.sin(angle2);

    const cos3 = Math.cos(angle3);
    const sin3 = Math.sin(angle3);

    const normals = new Float32Array([
      // A
      -cos1,
      sin1,
      0,
      // B
      cos1,
      sin1,
      0,
      // C
      -cos2,
      sin2,
      0,
      // D
      cos2,
      sin2,
      0,
      // F
      -cos3,
      sin3,
      0,
      // F'
      cos3,
      sin3,
      0,
      // G (tip)
      0.0,
      1.0,
      0,
    ]);

    const geometry = new InstancedBufferGeometry();
    const positionAttribute = new BufferAttribute(positions, 3);
    positionAttribute.setUsage(StaticDrawUsage);
    geometry.setAttribute("position", positionAttribute);
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));

    return geometry;
  }

  // private createBladeGeometryLow() {
  //   const halfWidth = grassConfig.BLADE_WIDTH / 2;
  //   const height = grassConfig.BLADE_HEIGHT;

  //   const positions = new Float32Array([
  //     -halfWidth,
  //     0,
  //     0, // A
  //     halfWidth,
  //     0,
  //     0, // B
  //     0,
  //     height,
  //     0, // C
  //   ]);

  //   const uvs = new Float32Array([
  //     0,
  //     0, // A
  //     1,
  //     0, // B
  //     0.5,
  //     1, // C
  //   ]);

  //   const angleDeg1 = 25;
  //   const angleRad1 = (angleDeg1 * Math.PI) / 180;
  //   const cosTheta1 = Math.cos(angleRad1);
  //   const sinTheta1 = Math.sin(angleRad1);

  //   const normals = new Float32Array([
  //     -cosTheta1,
  //     sinTheta1,
  //     0, // A
  //     cosTheta1,
  //     sinTheta1,
  //     0, // B
  //     0.0,
  //     1.0,
  //     0, // C (Tip remains straight)
  //   ]);

  //   const indices = new Uint16Array([0, 1, 2]);

  //   const geometry = new InstancedBufferGeometry();
  //   geometry.setAttribute("position", new BufferAttribute(positions, 3));
  //   geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  //   geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  //   geometry.setIndex(new BufferAttribute(indices, 1));
  //   return geometry;
  // }

  // private createBladeGeometry() {
  //   //    E
  //   //   /  \
  //   //  C----D
  //   // |  \   |
  //   // A------B
  //   const halfWidth = grassConfig.BLADE_WIDTH / 2;
  //   const quarterWidth = halfWidth / 2;
  //   const segmentHeight = grassConfig.BLADE_HEIGHT / 2;
  //   const positions = new Float32Array([
  //     -halfWidth,
  //     0,
  //     0, // A
  //     halfWidth,
  //     0,
  //     0, // B
  //     -quarterWidth,
  //     segmentHeight * 1,
  //     0, // C
  //     quarterWidth,
  //     segmentHeight * 1,
  //     0, // D
  //     0,
  //     segmentHeight * 2,
  //     0, // E
  //   ]);
  //   const uvs = new Float32Array([
  //     0,
  //     0, // A
  //     1,
  //     0, // B
  //     0.25,
  //     segmentHeight * 1, // C
  //     0.75,
  //     segmentHeight * 1, // D
  //     0.5,
  //     segmentHeight * 2, // E
  //   ]);

  //   const indices = new Uint16Array([
  //     // A-B-D A-D-C
  //     0, 1, 3, 0, 3, 2,
  //     // C-D-E
  //     2, 3, 4,
  //   ]);

  //   const angleDeg1 = 25;
  //   const angleRad1 = (angleDeg1 * Math.PI) / 180;
  //   const cosTheta1 = Math.cos(angleRad1);
  //   const sinTheta1 = Math.sin(angleRad1);

  //   const angleDeg2 = 15;
  //   const angleRad2 = (angleDeg2 * Math.PI) / 180;
  //   const cosTheta2 = Math.cos(angleRad2);
  //   const sinTheta2 = Math.sin(angleRad2);

  //   const normals = new Float32Array([
  //     -cosTheta1,
  //     sinTheta1,
  //     0, // A
  //     cosTheta1,
  //     sinTheta1,
  //     0, // B
  //     -cosTheta2,
  //     sinTheta2,
  //     0, // C
  //     cosTheta2,
  //     sinTheta2,
  //     0, // D
  //     0.0,
  //     1.0,
  //     0, // E (Tip remains straight)
  //   ]);

  //   const geometry = new InstancedBufferGeometry();
  //   geometry.setAttribute("position", new BufferAttribute(positions, 3));
  //   geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  //   geometry.setIndex(new BufferAttribute(indices, 1));
  //   geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  //   return geometry;
  // }

  private async updateAsync(state: State) {
    const { player } = state;
    const dx = player.position.x - this.grassField.position.x;
    const dz = player.position.z - this.grassField.position.z;
    this.uniforms.uDelta.value.set(dx, dz);
    this.uniforms.uPlayerPosition.value.copy(player.position);
    this.uniforms.uCameraMatrix.value
      .copy(sceneManager.playerCamera.projectionMatrix)
      .multiply(sceneManager.playerCamera.matrixWorldInverse);

    this.grassField.position.copy(player.position).setY(0);

    this.material.updateAsync();
  }
}
