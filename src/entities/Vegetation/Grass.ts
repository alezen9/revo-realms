import {
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedBufferGeometry,
  Matrix4,
  Mesh,
  Vector2,
  Vector3,
} from "three";
import { State } from "../../Game";
import {
  Fn,
  mix,
  pow,
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
  fract,
  abs,
  max,
  clamp,
  If,
  Discard,
  mod,
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
import { tslUtils } from "../../systems/TSLUtils";

const getConfig = () => {
  const BLADE_WIDTH = 0.1;
  const BLADE_HEIGHT = 1.5;
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
  uTime?: UniformType<number>;
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
  uTime: uniform(0),
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
  uGlowColor: uniform(new Color().setRGB(0.45, 0.19, 0.07)),
  // Bending
  uBladeMaxBendAngle: uniform(Math.PI * 0.15),
  uWindStrength: uniform(0.6),
  // Color
  uBaseColor: uniform(new Color().setRGB(0.06, 0.06, 0.01)),
  uTipColor: uniform(new Color().setRGB(0.28, 0.13, 0.06)),
  // Updated externally
  uDelta: uniform(new Vector2(0, 0)),
};

class GrassMaterial extends MeshBasicNodeMaterial {
  _uniforms: Required<GrassUniforms>;
  private _buffer1: ReturnType<typeof instancedArray>; // holds: vec4 = (localOffset.x, localOffset.y, yaw, bending angle)
  private _buffer2: ReturnType<typeof instancedArray>; // holds: vec4 = (current scale, original scale, alpha, glow)

  constructor(uniforms?: GrassUniforms) {
    super();
    this._uniforms = { ...defaultUniforms, ...uniforms };
    this._buffer1 = instancedArray(grassConfig.COUNT, "vec4");
    this._buffer1.setPBO(true);
    this._buffer2 = instancedArray(grassConfig.COUNT, "vec4");
    this._buffer2.setPBO(true);

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
    this.createGrassMaterial();
  }

  private computeInit = Fn(() => {
    const data1 = this._buffer1.element(instanceIndex);
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
    const noiseX = noise.b.sub(0.5).mul(30);
    const noiseZ = noise.g.sub(0.5).mul(10);

    data1.x = offsetX.add(noiseX);
    data1.y = offsetZ.add(noiseZ);

    // Yaw
    const yawVariation = noise.b.sub(0.5).mul(float(Math.PI * 2)); // Map noise to [-PI, PI]
    data1.z = yawVariation;

    // Scale
    const data2 = this._buffer2.element(instanceIndex);
    const scaleRange = this._uniforms.uBladeMaxScale.sub(
      this._uniforms.uBladeMinScale,
    );
    const randomScale = hash(instanceIndex.add(100))
      .mul(scaleRange)
      .add(this._uniforms.uBladeMinScale);

    data2.x = randomScale;
    data2.y = randomScale;
  })().compute(grassConfig.COUNT);

  private computeVisibility = Fn(([worldPos = vec3(0)]) => {
    const clipPos = this._uniforms.uCameraMatrix.mul(vec4(worldPos, 1.0));

    // Convert to normalized device coordinates
    const ndc = clipPos.xyz.div(clipPos.w);

    // Compute an approximate threshold for the blade's radius in NDC space.
    const radiusNDC = grassConfig.BLADE_BOUNDING_SPHERE_RADIUS;

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
    ([data1 = vec4(0, 0, 0, 0), worldPos = vec3(0, 0, 0)]) => {
      const windUV = worldPos.xz.add(this._uniforms.uTime.mul(0.25)).mul(0.5);

      const stableUV = fract(windUV);

      const windStrength = texture(assetManager.noiseTexture, stableUV, 5).r;

      const targetBendAngle = windStrength.mul(this._uniforms.uWindStrength);

      return data1.w.add(targetBendAngle.sub(data1.w).mul(0.1));
    },
  );

  private computeAlpha = Fn(([worldPos = vec3(0)]) => {
    const alphaUv = tslUtils.computeMapUvByPosition(worldPos.xz);
    return texture(assetManager.terrainTypeMap, alphaUv).g;
  });

  private computeTrailScale = Fn(
    ([data2 = vec4(0), isBladeSteppedOn = float(0)]) => {
      const growScale = data2.x.add(this._uniforms.uTrailGrowthRate);

      const growScaleFactor = float(1).sub(isBladeSteppedOn);
      const targetScale = this._uniforms.uTrailMinScale
        .mul(isBladeSteppedOn)
        .add(growScale.mul(growScaleFactor));

      return min(targetScale, data2.y);
    },
  );

  private computeTrailGlow = Fn(
    ([
      data2 = vec4(0),
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
      const isBladeAffected = max(isPlayerMoving, data2.w).mul(baseGlowFactor);

      // Compute fade-in when affected, fade-out when not affected
      const fadeIn = isBladeAffected.mul(this._uniforms.uGlowFadeIn);
      const fadeOut = float(1)
        .sub(isBladeAffected)
        .mul(this._uniforms.uGlowFadeOut);

      // Force fade-out when **fully stationary**
      const forceFadeOut = float(1)
        .sub(isPlayerMoving)
        .mul(this._uniforms.uGlowFadeOut)
        .mul(data2.w);

      // Apply glow effect and ensure full fade-out when stationary
      return clamp(
        data2.w.add(fadeIn).sub(fadeOut).sub(forceFadeOut),
        0.0,
        1.0,
      );
    },
  );

  private computeUpdate = Fn(() => {
    const data1 = this._buffer1.element(instanceIndex);
    const data2 = this._buffer2.element(instanceIndex);
    // Position
    const newOffsetX = mod(
      data1.x.sub(this._uniforms.uDelta.x).add(grassConfig.TILE_HALF_SIZE),
      grassConfig.TILE_SIZE,
    ).sub(grassConfig.TILE_HALF_SIZE);
    const newOffsetZ = mod(
      data1.y.sub(this._uniforms.uDelta.y).add(grassConfig.TILE_HALF_SIZE),
      grassConfig.TILE_SIZE,
    ).sub(grassConfig.TILE_HALF_SIZE);
    const pos = vec3(newOffsetX, 0, newOffsetZ);

    data1.x = newOffsetX;
    data1.y = newOffsetZ;

    const worldPos = pos.add(this._uniforms.uPlayerPosition);

    // Visibility
    const isVisible = this.computeVisibility(worldPos);
    data2.z = isVisible;

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
      data2.x = this.computeTrailScale(data2, isBladeSteppedOn);
      // Alpha
      data2.z = this.computeAlpha(worldPos);
      // Wind
      data1.w = this.computeBending(data1, worldPos);
      // Glow
      data2.w = this.computeTrailGlow(
        data2,
        distSq,
        isBladeSteppedOn,
        isPlayerGrounded,
      );
    });
  })().compute(grassConfig.COUNT);

  private computePosition = Fn(([data1 = vec4(0), data2 = vec4(0)]) => {
    const offset = vec3(data1.x, 0, data1.y);
    const yawAngle = data1.z;
    const bendingAngle = data1.w;
    const scale = data2.x;
    const bendAmount = bendingAngle.mul(uv().y);
    const bentPosition = rotate(positionLocal, vec3(bendAmount, 0, 0));
    const scaled = bentPosition.mul(vec3(1, scale, 1));
    const rotated = rotate(scaled, vec3(0, yawAngle, 0));

    const randomPhase = hash(instanceIndex).mul(6.28); // Random phase in range [0, 2π]
    const swayAmount = sin(
      this._uniforms.uTime.mul(5.0).add(data1.w).add(randomPhase),
    ).mul(0.1);
    const swayFactor = uv().y.mul(data2.w);
    const swayOffset = swayAmount.mul(swayFactor);

    const worldPosition = rotated.add(offset).add(vec3(swayOffset));
    return worldPosition;
  });

  private computeDiffuseColor = Fn(([data2 = vec4(0)]) => {
    const verticalFactor = pow(uv().y, 1.5);
    const baseToTip = mix(
      this._uniforms.uBaseColor,
      this._uniforms.uTipColor,
      verticalFactor,
    );

    const colorVariation = hash(instanceIndex).mul(0.05).sub(0.025);
    const glowFactor = data2.w;
    const finalColor = mix(
      baseToTip.add(colorVariation),
      this._uniforms.uGlowColor.mul(0.5),
      glowFactor,
    );

    return finalColor;
  });

  private computeAO = Fn(([data1 = vec4(0)]) => {
    const sideAO = abs(sin(data1.z)).mul(0.5);
    const verticalAO = smoothstep(-2.5, 1.25, uv().y);
    return verticalAO.mul(float(1.0).sub(sideAO));
  });

  // private computeCurvedNormal = Fn(() => {
  //   // Fake cylindrical shape by curving normals
  //   const sideFactor = sin(uv().x.mul(Math.PI)); // Smoother curvature: -1 -> 0 -> 1
  //   const heightFactor = pow(uv().y, 1.5); // Softer curvature transition toward the tip

  //   // Stronger curvature at the base, softer at the tip
  //   const curvatureStrength = mix(0.6, 0.15, heightFactor);

  //   // Subtle Twisting for Organic Shape
  //   const twistStrength = mix(0.0, 0.2, heightFactor); // Slight twist near the tip
  //   const twistAngle = uv().y.mul(Math.PI).mul(twistStrength); // Vary twist over height

  //   // Apply combined curvature and twist for cylindrical illusion
  //   let curvedNormal = normalize(
  //     vec3(
  //       sideFactor.mul(curvatureStrength).cos().sub(twistAngle.sin().mul(0.1)), // Side curvature with slight twist
  //       twistAngle.sin().mul(0.05), // Subtle upward twist
  //       1.0,
  //     ),
  //   );

  //   // Transform Normals to World Space
  //   curvedNormal = normalize(
  //     transformDirection(curvedNormal, modelNormalMatrix),
  //   );

  //   // Correct for Backface Rendering
  //   curvedNormal = mix(
  //     curvedNormal,
  //     curvedNormal.negate(),
  //     float(faceDirection.lessThan(0.0)),
  //   );

  //   return curvedNormal;
  // });

  private createGrassMaterial() {
    this.precision = "lowp";
    this.side = DoubleSide;
    const data1 = this._buffer1.element(instanceIndex);
    const data2 = this._buffer2.element(instanceIndex);
    Discard(data2.z.equal(0));
    this.positionNode = this.computePosition(data1, data2);
    this.opacityNode = data2.z;
    this.alphaTest = 0.25;
    this.aoNode = this.computeAO(data1);
    this.colorNode = this.computeDiffuseColor(data2);
  }

  async updateAsync() {
    await rendererManager.renderer.computeAsync(this.computeUpdate);
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
    uTime: uniform(0),
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

    eventsManager.on("update", this.updateAsync.bind(this));

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
      -quarterWidth,
      segmentHeight * 1,
      0,
      quarterWidth,
      segmentHeight * 1,
      0,
      // F, F'
      -quarterWidth * 0.5,
      segmentHeight * 2,
      0,
      quarterWidth * 0.5,
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

    const indices = new Uint16Array([
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
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
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
    const { player, clock } = state;
    const dx = player.position.x - this.grassField.position.x;
    const dz = player.position.z - this.grassField.position.z;
    this.uniforms.uDelta.value.set(dx, dz);
    this.uniforms.uPlayerPosition.value.copy(player.position);
    this.uniforms.uCameraMatrix.value
      .copy(sceneManager.camera.projectionMatrix)
      .multiply(sceneManager.camera.matrixWorldInverse);
    this.uniforms.uTime.value = clock.getElapsedTime();

    this.grassField.position.copy(player.position).setY(0);

    await this.material.updateAsync();
  }
}
