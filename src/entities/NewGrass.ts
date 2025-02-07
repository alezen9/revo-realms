import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  Texture,
  Vector2,
  Vector3,
} from "three";
import { State } from "../Game";
import {
  Fn,
  mix,
  pow,
  smoothstep,
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
  mod,
  texture,
  vec2,
  min,
  step,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import alphaTextureUrl from "/textures/test.webp?url";

const getConfig = () => {
  const BLADE_WIDTH = 0.1;
  const BLADE_HEIGHT = 1.25;
  const TILE_WIDTH = 50;
  const TILE_HEIGHT = 50;
  const BLADES_PER_WIDTH = 200;
  const BLADES_PER_HEIGHT = 200;
  return {
    BLADE_WIDTH,
    BLADE_HEIGHT,
    TILE_WIDTH,
    TILE_HEIGHT,
    TILE_HALF_WIDTH: TILE_WIDTH / 2,
    TILE_HALF_HEIGHT: TILE_HEIGHT / 2,
    BLADES_PER_WIDTH,
    BLADES_PER_HEIGHT,
    COUNT: BLADES_PER_WIDTH * BLADES_PER_HEIGHT,
    SPACING_WIDTH: TILE_WIDTH / BLADES_PER_WIDTH,
    SPACING_HEIGHT: TILE_HEIGHT / BLADES_PER_HEIGHT,
  };
};

const config = getConfig();

export default class NewGrass {
  private uDelta = uniform(new Vector2(0));
  private tile: InstancedMesh<BufferGeometry, GrassMaterial>;
  private material: GrassMaterial;

  constructor(scene: State["scene"]) {
    this.material = new GrassMaterial({ uDelta: this.uDelta });
    this.tile = this.createTile();
    scene.add(this.tile);
  }

  private createTile() {
    const geometry = this.createBladeGeometry();
    const instances = new InstancedMesh(geometry, this.material, config.COUNT);
    instances.frustumCulled = false;
    return instances;
  }

  private createBladeGeometry() {
    /**
     *        C
     *      /   \
     *    A ------ B
     *
     *  - Single triangle:  A-B-C
     */

    const halfWidth = config.BLADE_WIDTH / 2;
    const height = config.BLADE_HEIGHT;

    const positions = new Float32Array([
      -halfWidth,
      0,
      0, // A
      halfWidth,
      0,
      0, // B
      0,
      height,
      0, // C
    ]);

    const uvs = new Float32Array([
      0,
      0, // A
      1,
      0, // B
      0.5,
      1, // C
    ]);

    // const indices = new Uint8Array([
    //   0,
    //   1,
    //   2, // A-B-C
    // ]);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    // geometry.setIndex(new BufferAttribute(indices, 1));
    // geometry.computeVertexNormals();

    return geometry;
  }

  async update(state: State) {
    const { player } = state;
    const dx = player.position.x - this.tile.position.x;
    const dz = player.position.z - this.tile.position.z;

    this.uDelta.value.set(dx, dz);

    this.tile.position.copy(player.position).setY(0);
    await this.material.update(state);
  }
}

type UniformType<T> = ReturnType<typeof uniform<T>>;

type GrassUniforms = {
  // compute
  uDelta: UniformType<Vector2>;
  uPlayerPosition?: UniformType<Vector3>;
  uBladeMinScale?: UniformType<number>;
  uBladeMaxScale?: UniformType<number>;
  uTrailGrowthRate?: UniformType<number>;
  uTrailMinScale?: UniformType<number>;
  uTrailRaius?: UniformType<number>;
  uTrailRaiusSquared?: UniformType<number>;
  uBladeMaxBendAngle?: UniformType<number>;

  // color
  uBaseColor?: UniformType<Color>;
  uTipColor?: UniformType<Color>;
};

const defaultUniforms: Required<GrassUniforms> = {
  // compute
  uDelta: uniform(new Vector2(0, 0)),
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uBladeMinScale: uniform(0.5),
  uBladeMaxScale: uniform(1.25),
  uTrailGrowthRate: uniform(0.004),
  uTrailMinScale: uniform(0.1),
  uTrailRaius: uniform(0.65),
  uTrailRaiusSquared: uniform(0.65 * 0.65),
  uBladeMaxBendAngle: uniform(Math.PI * 0.15), // ~ 27deg
  // color
  uBaseColor: uniform(new Color("#4f8a4f")),
  uTipColor: uniform(new Color("#f7ff3d")),
};

class GrassMaterial extends MeshBasicNodeMaterial {
  private _uniforms: Required<GrassUniforms>;
  private _buffer1: ReturnType<typeof instancedArray>; // x, z (y), opacity
  private _buffer2: ReturnType<typeof instancedArray>; // yaw angle, current scale, original scale, bending angle
  private _alphaTexture: Texture;

  constructor(uniforms: GrassUniforms) {
    super();
    this._uniforms = { ...defaultUniforms, ...uniforms };

    this._buffer1 = instancedArray(config.COUNT, "vec3");
    this._buffer1.setPBO(true);
    this._buffer2 = instancedArray(config.COUNT, "vec4");
    this._buffer2.setPBO(true);
    this._alphaTexture = assetManager.textureLoader.load(alphaTextureUrl);
    this._alphaTexture.flipY = false;
    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });

    this.createGrassMaterial();
  }

  private computeInit = Fn(() => {
    // Position
    const offset = this._buffer1.element(instanceIndex);
    const row = floor(float(instanceIndex).div(config.BLADES_PER_WIDTH));
    const col = float(instanceIndex).mod(config.BLADES_PER_WIDTH);

    const randX = hash(instanceIndex);
    const randZ = hash(instanceIndex.add(1234));

    const offsetX = col
      .mul(config.SPACING_WIDTH)
      .sub(config.TILE_HALF_WIDTH)
      .add(randX.mul(config.SPACING_WIDTH * 0.5)); // Randomness

    const offsetZ = row
      .mul(config.SPACING_HEIGHT)
      .sub(config.TILE_HEIGHT)
      .add(randZ.mul(config.SPACING_HEIGHT * 0.5)); // Randomness

    offset.x = offsetX;
    offset.y = offsetZ;

    // Compute alpha once per blade
    const mapSize = float(256);
    const worldPos = vec2(offsetX, offsetZ)
      .add(this._uniforms.uPlayerPosition.xz)
      .add(mapSize.mul(0.5))
      .div(mapSize);
    const alphaValue = texture(this._alphaTexture, worldPos).r; // Sample once per instance
    offset.z = alphaValue;

    // Additional info
    const additional = this._buffer2.element(instanceIndex);

    // Yaw
    const randomBladeYaw = hash(instanceIndex.add(200))
      .mul(float(Math.PI * 2))
      .sub(float(Math.PI));
    additional.x = randomBladeYaw;

    // Scale
    const scaleRange = this._uniforms.uBladeMaxScale.sub(
      this._uniforms.uBladeMinScale,
    );
    const randomScale = hash(instanceIndex.add(100))
      .mul(scaleRange)
      .add(this._uniforms.uBladeMinScale);

    additional.y = randomScale; // current
    additional.z = randomScale; // original

    // Bending angle
    const randomBladeBend = hash(instanceIndex.add(300))
      .mul(this._uniforms.uBladeMaxBendAngle.mul(2))
      .sub(this._uniforms.uBladeMaxBendAngle);

    additional.w = randomBladeBend;
  })().compute(config.COUNT);

  private computeUpdate = Fn(() => {
    // Position
    const offset = this._buffer1.element(instanceIndex);
    const newOffsetX = mod(
      offset.x.sub(this._uniforms.uDelta.x).add(config.TILE_HALF_WIDTH),
      config.TILE_WIDTH,
    ).sub(config.TILE_HALF_WIDTH);
    const newOffsetZ = mod(
      offset.y.sub(this._uniforms.uDelta.y).add(config.TILE_HALF_HEIGHT),
      config.TILE_HEIGHT,
    ).sub(config.TILE_HALF_HEIGHT);

    offset.x = newOffsetX;
    offset.y = newOffsetZ;

    // Update alpha
    const mapSize = float(256);
    const worldPos = vec2(offset.x, offset.y)
      .add(this._uniforms.uPlayerPosition.xz)
      .add(mapSize.mul(0.5))
      .div(mapSize);
    const alphaValue = texture(this._alphaTexture, worldPos).r;
    offset.z = alphaValue;

    // Additional info
    const additional = this._buffer2.element(instanceIndex);
    // Trail
    // Compute distance to player
    const playerPos = vec2(this._uniforms.uDelta.x, this._uniforms.uDelta.y);
    const diff = vec2(offset.x, offset.y).sub(playerPos);
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
    const growScale = additional.y.add(this._uniforms.uTrailGrowthRate);

    // Compute new scale
    const growScaleFactor = float(1).sub(isBladeSteppedOn);
    const targetScale = this._uniforms.uTrailMinScale
      .mul(isBladeSteppedOn)
      .add(growScale.mul(growScaleFactor));

    additional.y = min(targetScale, additional.z);
  })().compute(config.COUNT);

  private computePosition = Fn(() => {
    const offsetData = this._buffer1.element(instanceIndex);
    const offset = vec3(offsetData.x, 0, offsetData.y);

    const additionalData = this._buffer2.element(instanceIndex);
    const yawAngle = additionalData.x;
    const scale = additionalData.y;
    const bendingAngle = additionalData.w;

    // Compute bending strength based on vertex height
    const bendFactor = positionLocal.y; // `y` in local space (0 at base, 1 at tip)
    const bendAmount = bendingAngle.mul(bendFactor); // More bending at the top

    // Apply bending: Rotate around the X-axis to tilt forward/backward
    const bentPosition = rotate(positionLocal, vec3(bendAmount, 0, 0));

    // Apply scaling
    const scaled = bentPosition.mul(vec3(1, scale, 1));

    // Apply rotation
    const rotated = rotate(scaled, vec3(0, yawAngle, 0));

    // Final world position
    return rotated.add(offset);
  });

  private computeOpacity = Fn(() => {
    const offsetData = this._buffer1.element(instanceIndex);
    return offsetData.z;
  });

  private computeDiffuseColor = Fn(() => {
    const factor = pow(uv().y, 1.5);
    const blendedColor = mix(
      this._uniforms.uBaseColor,
      this._uniforms.uTipColor,
      factor,
    );
    return blendedColor;
  });

  private createGrassMaterial() {
    this.precision = "lowp";
    this.side = DoubleSide;

    this.positionNode = this.computePosition();
    this.opacityNode = this.computeOpacity();
    this.alphaTest = 0.1;
    this.aoNode = smoothstep(-0.75, 1.25, uv().y);
    this.colorNode = this.computeDiffuseColor();
  }

  async update(state: State) {
    const { renderer, player } = state;
    this._uniforms.uPlayerPosition.value.copy(player.position);
    await renderer.computeAsync(this.computeUpdate);
  }
}
