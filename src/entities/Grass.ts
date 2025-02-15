import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  Sphere,
  Vector2,
  Vector3,
} from "three";
import { State } from "../Game";
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
  mod,
  vec2,
  texture,
  step,
  min,
  sin,
  fract,
  abs,
  max,
  clamp,
} from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import { realmConfig } from "../realms/PortfolioRealm";

const getConfig = () => {
  const BLADE_WIDTH = 0.2;
  const BLADE_HEIGHT = 1.25;
  const TILE_SIZE = 150;
  const BLADES_PER_SIDE = 600;
  return {
    BLADE_WIDTH,
    BLADE_HEIGHT,
    TILE_SIZE,
    TILE_HALF_SIZE: TILE_SIZE / 2,
    BLADES_PER_SIDE,
    COUNT: BLADES_PER_SIDE * BLADES_PER_SIDE,
    SPACING: TILE_SIZE / BLADES_PER_SIDE,
    boundingBox: new Box3(
      new Vector3(-TILE_SIZE / 2, 0, -TILE_SIZE / 2),
      new Vector3(TILE_SIZE / 2, BLADE_HEIGHT * 2, TILE_SIZE / 2),
    ),
    boundingSphere: new Sphere(
      new Vector3(0, 0, 0),
      (TILE_SIZE / 2) * Math.sqrt(2),
    ),
  };
};
const grassConfig = getConfig();

type UniformType<T> = ReturnType<typeof uniform<T>>;
type GrassUniforms = {
  uTime?: UniformType<number>;
  uPlayerPosition?: UniformType<Vector3>;
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
  // Color
  uBaseColor?: UniformType<Color>;
  uTipColor?: UniformType<Color>;
  // Updated externally
  uDelta: UniformType<Vector2>;
};

const defaultUniforms: Required<GrassUniforms> = {
  uTime: uniform(0),
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  // Scale
  uBladeMinScale: uniform(0.5),
  uBladeMaxScale: uniform(1.25),
  // Trail
  uTrailGrowthRate: uniform(0.004),
  uTrailMinScale: uniform(0.1),
  uTrailRaius: uniform(0.65),
  uTrailRaiusSquared: uniform(0.65 * 0.65),
  // Glow
  uGlowRadius: uniform(2),
  uGlowRadiusSquared: uniform(4),
  uGlowFadeIn: uniform(0.05),
  uGlowFadeOut: uniform(0.01),
  uGlowColor: uniform(new Color(1.0, 0.6, 0.1)),
  // Bending
  uBladeMaxBendAngle: uniform(Math.PI * 0.15),
  // Color
  uBaseColor: uniform(new Color("#4f8a4f")),
  uTipColor: uniform(new Color("#bbde47")),
  // Updated externally
  uDelta: uniform(new Vector2(0, 0)),
};

class GrassMaterial extends MeshStandardNodeMaterial {
  _uniforms: Required<GrassUniforms>;
  private _buffer1: ReturnType<typeof instancedArray>; // holds: vec4 = (localOffset.x, localOffset.y, yaw, bending angle)
  private _buffer2: ReturnType<typeof instancedArray>; // holds: vec4 = (current scale, original scale, alpha, glow)
  constructor() {
    super();
    this._uniforms = defaultUniforms;
    this._buffer1 = instancedArray(grassConfig.COUNT, "vec4");
    this._buffer1.setPBO(true);
    this._buffer2 = instancedArray(grassConfig.COUNT, "vec4");
    this._buffer2.setPBO(true);

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
    this.createGrassMaterial();
  }

  setDelta(dx: number, dz: number) {
    this._uniforms.uDelta.value.set(dx, dz);
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
    data1.x = offsetX;
    data1.y = offsetZ;

    // Yaw
    const noiseUV = vec2(data1.x, data1.y)
      .div(grassConfig.TILE_HALF_SIZE)
      .add(1);
    const noiseScale = float(1);
    const uv = fract(noiseUV.mul(noiseScale));
    const noiseValue = texture(assetManager.randomNoiseTexture, uv).r;
    const yawVariation = noiseValue.sub(0.5).mul(float(Math.PI)); // Map noise to [-PI/2, PI/2]
    data1.z = yawVariation;
    // const randomBladeYaw = hash(instanceIndex.add(200))
    //   .mul(float(Math.PI * 2))
    //   .sub(float(Math.PI));
    // data1.z = randomBladeYaw;

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

  private computeUpdate = Fn(() => {
    const data1 = this._buffer1.element(instanceIndex);
    // Position
    const newOffsetX = mod(
      data1.x.sub(this._uniforms.uDelta.x).add(grassConfig.TILE_HALF_SIZE),
      grassConfig.TILE_SIZE,
    ).sub(grassConfig.TILE_HALF_SIZE);
    const newOffsetZ = mod(
      data1.y.sub(this._uniforms.uDelta.y).add(grassConfig.TILE_HALF_SIZE),
      grassConfig.TILE_SIZE,
    ).sub(grassConfig.TILE_HALF_SIZE);

    data1.x = newOffsetX;
    data1.y = newOffsetZ;

    const pos = vec2(data1.x, data1.y);

    // Wind
    const windUV = pos
      .add(this._uniforms.uPlayerPosition.xz)
      .add(this._uniforms.uTime.mul(0.25))
      .mul(0.5);

    const stableUV = fract(windUV);

    const windStrength = texture(
      assetManager.perlinNoiseTexture,
      stableUV,
      5,
    ).r;

    const targetBendAngle = windStrength.mul(0.35);

    data1.w = data1.w.add(targetBendAngle.sub(data1.w).mul(0.1));

    // Alpha
    const data2 = this._buffer2.element(instanceIndex);
    const mapSize = float(realmConfig.MAP_SIZE);
    const worldPos = pos
      .add(this._uniforms.uPlayerPosition.xz)
      .add(mapSize.mul(0.5))
      .div(mapSize);
    const alphaValue = texture(assetManager.realmGrassMap, worldPos).r;
    data2.z = alphaValue;

    // Trail
    // Compute distance to player
    const playerPos = vec2(this._uniforms.uDelta.x, this._uniforms.uDelta.y);
    const diff = pos.sub(playerPos);
    const distSq = diff.dot(diff);

    // Check if the player is on the ground (arbitrary threshold for jumping)
    const isPlayerGrounded = step(
      0.1,
      float(1).sub(this._uniforms.uPlayerPosition.y),
    ); // 1 if grounded, 0 if airborne
    const isBladeSteppedOn = step(
      distSq,
      this._uniforms.uTrailRaiusSquared,
    ).mul(isPlayerGrounded); // 1 if stepped on, 0 if not
    const growScale = data2.x.add(this._uniforms.uTrailGrowthRate);

    // Scale
    const growScaleFactor = float(1).sub(isBladeSteppedOn);
    const targetScale = this._uniforms.uTrailMinScale
      .mul(isBladeSteppedOn)
      .add(growScale.mul(growScaleFactor));

    data2.x = min(targetScale, data2.y);

    // Glow
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
    data2.w = clamp(
      data2.w.add(fadeIn).sub(fadeOut).sub(forceFadeOut),
      0.0,
      1.0,
    );
  })().compute(grassConfig.COUNT);

  private computePosition = Fn(
    ([data1 = vec4(0, 0, 0, 0), data2 = vec3(0, 0, 0)]) => {
      const offset = vec3(data1.x, 0, data1.y);
      const yawAngle = data1.z;
      const bendingAngle = data1.w;
      const scale = data2.x;
      const bendAmount = bendingAngle.mul(uv().y);
      const bentPosition = rotate(positionLocal, vec3(bendAmount, 0, 0));
      const scaled = bentPosition.mul(vec3(1, scale, 1));
      const rotated = rotate(scaled, vec3(0, yawAngle, 0));
      const worldPosition = rotated.add(offset);
      return worldPosition;
    },
  );

  private computeDiffuseColor = Fn(([data2 = vec4(0, 0, 0, 0)]) => {
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
      this._uniforms.uGlowColor,
      glowFactor,
    );

    return finalColor;
  });

  private computeAO = Fn(() => {
    const sideAO = abs(sin(this._buffer1.element(instanceIndex).z)).mul(0.5);
    const verticalAO = smoothstep(-0.75, 1.25, uv().y);
    return verticalAO.mul(float(1.0).sub(sideAO));
  });

  private createGrassMaterial() {
    this.precision = "lowp";
    this.side = DoubleSide;
    const data1 = this._buffer1.element(instanceIndex);
    const data2 = this._buffer2.element(instanceIndex);
    this.positionNode = this.computePosition(data1, data2);
    this.opacityNode = data2.z;
    this.alphaTest = 0.1;
    this.aoNode = this.computeAO();
    this.colorNode = this.computeDiffuseColor(data2);
  }

  async update(state: State) {
    const { renderer, player, clock } = state;
    this._uniforms.uTime.value = clock.getElapsedTime();
    this._uniforms.uPlayerPosition.value.copy(player.position);
    await renderer.computeAsync(this.computeUpdate);
  }
}

export default class Grass {
  private material: GrassMaterial;
  private grassField: InstancedMesh;

  constructor(scene: State["scene"]) {
    this.material = new GrassMaterial();
    this.grassField = this.createGrassField();
    scene.add(this.grassField);
  }

  private createGrassField() {
    const geometry = this.createBladeGeometry();
    const tile = new InstancedMesh(geometry, this.material, grassConfig.COUNT);
    tile.boundingBox = grassConfig.boundingBox;
    tile.boundingSphere = grassConfig.boundingSphere;
    return tile;
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

  //   const geometry = new BufferGeometry();
  //   geometry.setAttribute("position", new BufferAttribute(positions, 3));
  //   geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  //   geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  //   return geometry;
  // }

  private createBladeGeometry() {
    //    E
    //   /  \
    //  C----D
    // |  \   |
    // A------B
    const halfWidth = grassConfig.BLADE_WIDTH / 2;
    const quarterWidth = halfWidth / 2;
    const segmentHeight = grassConfig.BLADE_HEIGHT / 2;
    const positions = new Float32Array([
      -halfWidth,
      0,
      0, // A
      halfWidth,
      0,
      0, // B
      -quarterWidth,
      segmentHeight * 1,
      0, // C
      quarterWidth,
      segmentHeight * 1,
      0, // D
      0,
      segmentHeight * 2,
      0, // E
    ]);
    const uvs = new Float32Array([
      0,
      0, // A
      1,
      0, // B
      0.25,
      segmentHeight * 1, // C
      0.75,
      segmentHeight * 1, // D
      0.5,
      segmentHeight * 2, // E
    ]);

    const indices = new Uint16Array([
      // A-B-D A-D-C
      0, 1, 3, 0, 3, 2,
      // C-D-E
      2, 3, 4,
    ]);

    const angleDeg1 = 25;
    const angleRad1 = (angleDeg1 * Math.PI) / 180;
    const cosTheta1 = Math.cos(angleRad1);
    const sinTheta1 = Math.sin(angleRad1);

    const angleDeg2 = 15;
    const angleRad2 = (angleDeg2 * Math.PI) / 180;
    const cosTheta2 = Math.cos(angleRad2);
    const sinTheta2 = Math.sin(angleRad2);

    const normals = new Float32Array([
      -cosTheta1,
      sinTheta1,
      0, // A
      cosTheta1,
      sinTheta1,
      0, // B
      -cosTheta2,
      sinTheta2,
      0, // C
      cosTheta2,
      sinTheta2,
      0, // D
      0.0,
      1.0,
      0, // E (Tip remains straight)
    ]);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    return geometry;
  }

  async updateAsync(state: State) {
    const { player } = state;
    const dx = player.position.x - this.grassField.position.x;
    const dz = player.position.z - this.grassField.position.z;
    this.material.setDelta(dx, dz);

    this.grassField.position.copy(player.position).setY(0);

    await this.material.update(state);
  }
}
