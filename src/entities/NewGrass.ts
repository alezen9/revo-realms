import {
  BufferAttribute,
  BufferGeometry,
  InstancedMesh,
  Texture,
  Vector2,
} from "three";
import { State } from "../Game";
import NewGrassMaterial from "../materials/NewGrassMaterial";
import {
  Fn,
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
  uniform,
  positionWorld,
  min,
  step,
} from "three/tsl";
import { assetManager } from "../systems/AssetManager";
import alphaTextureUrl from "/textures/test.webp?url";

export default class NewGrass {
  private readonly BLADE_WIDTH = 0.05;
  private readonly BLADE_HEIGHT = 1.25;

  private readonly TILE_WIDTH = 50;
  private readonly TILE_HEIGHT = 50;
  private readonly HALF_TILE_WIDTH = this.TILE_WIDTH / 2;
  private readonly HALF_TILE_HEIGHT = this.TILE_HEIGHT / 2;

  private readonly BLADES_PER_WIDTH = 300; // Density along width
  private readonly BLADES_PER_HEIGHT = 300; // Density along height

  private readonly MIN_SCALE = 0.5;
  private readonly MAX_SCALE = 1.25;

  private readonly SPACING_WIDTH = this.TILE_WIDTH / this.BLADES_PER_WIDTH;
  private readonly SPACING_HEIGHT = this.TILE_HEIGHT / this.BLADES_PER_HEIGHT;

  private readonly COUNT = this.BLADES_PER_WIDTH * this.BLADES_PER_HEIGHT;

  private readonly TRAIL_GROWTH_RATE = 0.005;
  private readonly TRAIL_MIN_SCALE = 0.05;
  private readonly TRAIL_RADIUS = 0.65; // Radius of effect
  private readonly SQUARED_TRAIL_RAIUS = this.TRAIL_RADIUS * this.TRAIL_RADIUS;

  private readonly MAX_BEND_ANGLE = Math.PI * 0.15; // Max bend in radians (~27°)

  private uTime = uniform(0);
  private uDelta = uniform(new Vector2(0));
  private uPlayerYPosition = uniform(0);

  private offsetBuffer = instancedArray(this.COUNT, "vec2"); // x, z (y)
  private additionalBuffer = instancedArray(this.COUNT, "vec4"); // yaw angle, current scale, original scale, bending angle
  private tile: InstancedMesh<BufferGeometry, NewGrassMaterial>;
  private alphaTexture: Texture;

  constructor(scene: State["scene"]) {
    this.alphaTexture = assetManager.textureLoader.load(alphaTextureUrl);
    this.alphaTexture.flipY = false;
    this.offsetBuffer.setPBO(true);
    this.additionalBuffer.setPBO(true);
    this.tile = this.createTile();
    scene.add(this.tile);

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.compute(this.computeInit);
    });
  }

  private computePosition = Fn(() => {
    const offsetData = this.offsetBuffer.element(instanceIndex);
    const offset = vec3(offsetData.x, 0, offsetData.y);

    const additionalData = this.additionalBuffer.element(instanceIndex);
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
    const bladeOrigin = vec2(positionWorld.x, positionWorld.z);
    const mapSize = 256;
    const bladeUV = bladeOrigin.add(float(mapSize * 0.5)).div(float(mapSize));
    const sample = texture(this.alphaTexture, bladeUV).r;
    return sample;
  });

  private createTile() {
    const geometry = this.createBladeGeometry();
    const material = new NewGrassMaterial({});
    material.positionNode = this.computePosition();
    material.opacityNode = this.computeOpacity();
    material.alphaTest = 0.1;
    const instances = new InstancedMesh(geometry, material, this.COUNT);
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

    const halfWidth = this.BLADE_WIDTH / 2;
    const height = this.BLADE_HEIGHT;

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

  private computeInit = Fn(() => {
    // Position
    const offset = this.offsetBuffer.element(instanceIndex);
    const row = floor(float(instanceIndex).div(float(this.BLADES_PER_WIDTH)));
    const col = float(instanceIndex).mod(float(this.BLADES_PER_WIDTH));

    const randX = hash(instanceIndex);
    const randZ = hash(instanceIndex.add(1234));

    const offsetX = col
      .mul(float(this.SPACING_WIDTH))
      .sub(float(this.HALF_TILE_WIDTH))
      .add(randX.mul(float(this.SPACING_WIDTH * 0.5))); // Randomness

    const offsetZ = row
      .mul(float(this.SPACING_HEIGHT))
      .sub(float(this.HALF_TILE_HEIGHT))
      .add(randZ.mul(float(this.SPACING_HEIGHT * 0.5))); // Randomness

    offset.x = offsetX;
    offset.y = offsetZ;

    // Additional info
    const additional = this.additionalBuffer.element(instanceIndex);

    // Yaw
    const randomBladeYaw = hash(instanceIndex.add(200))
      .mul(float(Math.PI * 2))
      .sub(float(Math.PI));
    additional.x = randomBladeYaw;

    // Scale
    const scaleRange = float(this.MAX_SCALE - this.MIN_SCALE);
    const randomScale = hash(instanceIndex.add(100))
      .mul(scaleRange)
      .add(float(this.MIN_SCALE));

    additional.y = randomScale; // current
    additional.z = randomScale; // original

    // Bending angle
    const randomBladeBend = hash(instanceIndex.add(300))
      .mul(float(this.MAX_BEND_ANGLE * 2))
      .sub(float(this.MAX_BEND_ANGLE));

    additional.w = randomBladeBend;
  })().compute(this.COUNT);

  private computeUpdate = Fn(() => {
    // Position
    const offset = this.offsetBuffer.element(instanceIndex);
    const newOffsetX = mod(
      offset.x.sub(this.uDelta.x).add(this.HALF_TILE_WIDTH),
      this.TILE_WIDTH,
    ).sub(this.HALF_TILE_WIDTH);
    const newOffsetZ = mod(
      offset.y.sub(this.uDelta.y).add(this.HALF_TILE_HEIGHT),
      this.TILE_HEIGHT,
    ).sub(this.HALF_TILE_HEIGHT);

    offset.x = newOffsetX;
    offset.y = newOffsetZ;

    // Additional info
    const additional = this.additionalBuffer.element(instanceIndex);
    // Trail
    // Compute distance to player
    const playerPos = vec2(this.uDelta.x, this.uDelta.y);
    const diff = vec2(offset.x, offset.y).sub(playerPos);
    const distSq = diff.dot(diff);

    // Check if the player is on the ground (arbitrary threshold for jumping)
    const isPlayerGrounded = step(0.1, float(1).sub(this.uPlayerYPosition)); // 1 if grounded, 0 if airborne
    const isBladeSteppedOn = step(distSq, this.SQUARED_TRAIL_RAIUS).mul(
      isPlayerGrounded,
    ); // 1 if stepped on, 0 if not
    const growScale = additional.y.add(this.TRAIL_GROWTH_RATE);

    // Compute new scale
    const growScaleFactor = float(1).sub(isBladeSteppedOn);
    const targetScale = float(this.TRAIL_MIN_SCALE)
      .mul(isBladeSteppedOn)
      .add(growScale.mul(growScaleFactor));

    additional.y = min(targetScale, additional.z);
  })().compute(this.COUNT);

  async update(state: State) {
    const { renderer, clock, player } = state;
    const dx = player.position.x - this.tile.position.x;
    const dz = player.position.z - this.tile.position.z;

    this.uTime.value = clock.getElapsedTime();
    this.uDelta.value.set(dx, dz);
    this.uPlayerYPosition.value = player.position.y;

    this.tile.position.copy(player.position).setY(0);

    await renderer.computeAsync(this.computeUpdate);
  }
}
