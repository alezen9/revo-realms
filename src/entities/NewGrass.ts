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
  normalize,
  cos,
  sin,
} from "three/tsl";
import { assetManager } from "../systems/AssetManager";
import alphaTextureUrl from "/textures/test.webp?url";

export default class NewGrass {
  private readonly BLADE_WIDTH = 0.3;
  private readonly BLADE_HEIGHT = 0.8;

  private readonly TILE_WIDTH = 50;
  private readonly TILE_HEIGHT = 50;
  private readonly HALF_TILE_WIDTH = this.TILE_WIDTH / 2;
  private readonly HALF_TILE_HEIGHT = this.TILE_HEIGHT / 2;

  private readonly BLADES_PER_WIDTH = 250; // Density along width
  private readonly BLADES_PER_HEIGHT = 250; // Density along height

  private readonly MIN_SCALE = 0.5;
  private readonly MAX_SCALE = 1;

  private readonly SPACING_WIDTH = this.TILE_WIDTH / this.BLADES_PER_WIDTH;
  private readonly SPACING_HEIGHT = this.TILE_HEIGHT / this.BLADES_PER_HEIGHT;

  private readonly COUNT = this.BLADES_PER_WIDTH * this.BLADES_PER_HEIGHT;

  private readonly TRAIL_LENGTH = 20; // Number of steps in the trail
  private readonly TRAIL_FADE_SPEED = 0.02; // How fast grass regrows
  private readonly TRAIL_MIN_SCALE = 0.2; // Minimum scale (doesn’t fully disappear)
  // TODO: Use linked list instead
  private trailPositions = Array.from(
    { length: this.TRAIL_LENGTH },
    () => new Vector2(0, 0),
  );

  private uTime = uniform(0);
  private uDelta = uniform(new Vector2(0));
  private uTileYaw = uniform(0);

  private offsetBuffer = instancedArray(this.COUNT, "vec2"); // x, z (y)
  private additionalBuffer = instancedArray(this.COUNT, "vec3"); // rotation, scale, opacity
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
    const offset = this.offsetBuffer.element(instanceIndex);
    const additionalData = this.additionalBuffer.element(instanceIndex);
    const scale = additionalData.y;
    const scaled = positionLocal.mul(vec3(1, scale, 1));
    const rotationAngle = additionalData.x;
    const rotated = rotate(scaled, vec3(0, rotationAngle, 0));
    const worldPos = rotated.add(vec3(offset.x, 0, offset.y));
    return worldPos;
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

    const randomRotation = hash(instanceIndex.add(200))
      .mul(float(Math.PI * 2))
      .sub(float(Math.PI));

    const scaleRange = float(this.MAX_SCALE - this.MIN_SCALE);
    const randomScale = hash(instanceIndex.add(100))
      .mul(scaleRange)
      .add(float(this.MIN_SCALE));

    additional.x = randomRotation;
    additional.y = randomScale;
  })().compute(this.COUNT);

  private computeUpdate = Fn(() => {
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
  })().compute(this.COUNT);

  async update(state: State) {
    const { renderer, clock, player } = state;
    const dx = player.position.x - this.tile.position.x;
    const dz = player.position.z - this.tile.position.z;

    this.uTime.value = clock.getElapsedTime();
    this.uDelta.value.set(dx, dz);

    this.tile.position.copy(player.position).setY(0);

    this.trailPositions.pop();
    this.trailPositions.unshift(
      new Vector2(player.position.x, player.position.z),
    );

    await renderer.computeAsync(this.computeUpdate);
  }
}
