import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  Texture,
  Vector2,
  Vector3,
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
  cos,
  mod,
  normalize,
  sin,
  texture,
  vec2,
  uniform,
  positionWorld,
} from "three/tsl";
import { assetManager } from "../systems/AssetManager";
import alphaTextureUrl from "/textures/test.webp?url";

export default class NewGrass {
  private readonly TILE_SIZE = 75;
  private readonly HALF_TILE_SIZE = this.TILE_SIZE / 2;
  private readonly BLADE_WIDTH = 0.1;
  private readonly BLADE_HEIGHT = 0.5;
  private readonly BLADES_PER_SIDE = 750; // Number of blades along one side
  private readonly SPACING = this.TILE_SIZE / this.BLADES_PER_SIDE;
  private readonly COUNT = this.BLADES_PER_SIDE * this.BLADES_PER_SIDE;

  private uTime = uniform(0);
  private uDelta = uniform(new Vector2(0, 0));

  private offsetBuffer = instancedArray(this.COUNT, "vec2"); // x, z (y)
  private additionalBuffer = instancedArray(this.COUNT, "vec3"); // rotation, scale, opacity
  private tile: InstancedMesh<BufferGeometry, NewGrassMaterial>;
  private group: Group;
  private alphaTexture: Texture;

  constructor(scene: State["scene"]) {
    this.alphaTexture = assetManager.textureLoader.load(alphaTextureUrl);
    this.alphaTexture.flipY = false;
    this.offsetBuffer.setPBO(true);
    this.additionalBuffer.setPBO(true);
    this.tile = this.createTile();
    scene.add(this.tile);

    const group = new Group();
    // const t1 = this.createTile();
    // t1.position.set(-this.HALF_TILE_SIZE, 0, -this.HALF_TILE_SIZE);
    // group.add(t1);
    // const t2 = this.createTile();
    // t2.position.set(this.HALF_TILE_SIZE, 0, -this.HALF_TILE_SIZE);
    // group.add(t2);
    // const t3 = this.createTile();
    // t3.position.set(this.HALF_TILE_SIZE, 0, this.HALF_TILE_SIZE);
    // group.add(t3);
    // const t4 = this.createTile();
    // t4.position.set(-this.HALF_TILE_SIZE, 0, this.HALF_TILE_SIZE);
    // group.add(t4);

    // scene.add(group);
    this.group = group;

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.compute(this.computeInit);
    });
  }

  private computeWindAnimation = Fn(() => {
    const offset = this.offsetBuffer.element(instanceIndex);
    const additionalData = this.additionalBuffer.element(instanceIndex);
    const scale = additionalData.y;
    const scaled = positionLocal.mul(vec3(1, scale, 1));
    const rotationAngle = additionalData.x;
    const rotated = rotate(scaled, vec3(0, rotationAngle, 0));
    const worldPos = rotated.add(vec3(offset.x, 0, offset.y));
    return worldPos;
    // const bladeOrigin = vec2(worldPos.x, worldPos.z);

    // const timer = this.uTime.mul(0.025);

    // const bladeUV = mod(bladeOrigin.mul(0.05).add(timer), 1);
    // const noiseSample = texture(
    //   assetManager.perlinNoiseTexture,
    //   bladeUV.mul(2),
    //   2,
    // ).r;

    // const windAngle = noiseSample.mul(Math.PI * 0.1);
    // const windDir = normalize(vec2(cos(windAngle), sin(windAngle)));

    // const y = positionLocal.y.div(float(0.75));
    // const heightFactor = y.mul(y);
    // const bendStrength = noiseSample.mul(float(0.3)).mul(heightFactor);

    // const bendOffset = vec3(windDir.x, 0.0, windDir.y).mul(bendStrength);

    // return worldPos.add(bendOffset);
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
    material.positionNode = this.computeWindAnimation();
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
    const offset = this.offsetBuffer.element(instanceIndex);
    const additional = this.additionalBuffer.element(instanceIndex);
    const row = floor(float(instanceIndex).div(float(this.BLADES_PER_SIDE)));
    const col = float(instanceIndex).mod(float(this.BLADES_PER_SIDE));

    const randRow = hash(instanceIndex);
    const randCol = hash(instanceIndex.add(1234));

    const offsetX = row
      .mul(float(this.SPACING))
      .sub(float(this.HALF_TILE_SIZE))
      .add(randRow.mul(float(this.SPACING * 0.5)));

    const offsetZ = col
      .mul(float(this.SPACING))
      .sub(float(this.HALF_TILE_SIZE))
      .add(randCol.mul(float(this.SPACING * 0.5)));

    offset.x = offsetX;
    offset.y = offsetZ;

    const randomRotation = hash(instanceIndex.add(200))
      .mul(float(Math.PI * 2))
      .sub(float(Math.PI));

    const randomScale = hash(instanceIndex.add(100)).mul(0.5).add(0.75); // 0.75..1.25

    additional.x = randomRotation;
    additional.y = randomScale;
  })().compute(this.COUNT);

  private computeUpdate = Fn(() => {
    const offset = this.offsetBuffer.element(instanceIndex);
    const newOffsetX = mod(
      offset.x.sub(this.uDelta.x).add(this.HALF_TILE_SIZE),
      this.TILE_SIZE,
    ).sub(this.HALF_TILE_SIZE);
    const newOffsetZ = mod(
      offset.y.sub(this.uDelta.y).add(this.HALF_TILE_SIZE),
      this.TILE_SIZE,
    ).sub(this.HALF_TILE_SIZE);

    offset.x = newOffsetX;
    offset.y = newOffsetZ;
  })().compute(this.COUNT);

  async update(state: State) {
    const { renderer, clock, player } = state;
    this.uTime.value = clock.getElapsedTime();
    const dx = player.position.x - this.tile.position.x;
    const dz = player.position.z - this.tile.position.z;
    this.uDelta.value.set(dx, dz);
    this.tile.position.copy(player.position).setY(0);

    // const dx = player.position.x - this.group.position.x;
    // const dz = player.position.z - this.group.position.z;
    // this.uDelta.value.set(dx, dz);
    // this.group.position.copy(player.position).setY(0);
    await renderer.computeAsync(this.computeUpdate);
  }
}
