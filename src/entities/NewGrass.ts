import { BufferAttribute, BufferGeometry, InstancedMesh, Vector3 } from "three";
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
} from "three/tsl";
import { assetManager } from "../systems/AssetManager";

export default class NewGrass {
  private readonly TILE_SIZE = 40;
  private readonly HALF_TILE_SIZE = this.TILE_SIZE / 2;
  private readonly BLADE_WIDTH = 0.1;
  private readonly BLADE_HEIGHT = 0.75;
  private readonly BLADES_PER_SIDE = 400; // Number of blades along one side
  private readonly SPACING = this.TILE_SIZE / this.BLADES_PER_SIDE;
  private readonly COUNT = this.BLADES_PER_SIDE * this.BLADES_PER_SIDE;

  private uTime = uniform(0);
  private uPlayerPos = uniform(new Vector3(0, 0, 0));
  private uOldCenter = uniform(new Vector3(0, 0, 0)); // last frame's tile center

  private offsetBuffer = instancedArray(this.COUNT, "vec3"); // x, y, z
  private additionalBuffer = instancedArray(this.COUNT, "vec2"); // rotation, scale

  constructor(scene: State["scene"]) {
    this.offsetBuffer.setPBO(true);
    this.additionalBuffer.setPBO(true);
    this.computeUpdate.onInit(({ renderer }) => {
      renderer.compute(this.computeInit);
    });

    const instances = this.createGrassInstances();
    scene.add(instances);
  }

  private computeWindAnimation = Fn(() => {
    const offset = this.offsetBuffer.element(instanceIndex);
    const additionalData = this.additionalBuffer.element(instanceIndex);
    const scale = additionalData.y;
    const scaled = positionLocal.mul(vec3(1, scale, 1));
    const rotationAngle = additionalData.x;
    const rotated = rotate(scaled, vec3(0, rotationAngle, 0));
    const worldPos = rotated.add(offset);
    const bladeOrigin = vec2(worldPos.x, worldPos.z);

    // Timer
    const timer = this.uTime.mul(0.025);

    // UV for noise
    const bladeUV = mod(bladeOrigin.mul(0.05).add(timer), 1);
    const noiseSample = texture(assetManager.perlinNoiseTexture, bladeUV).r; // fetch from a noise texture

    // Convert sample to angle/direction
    const windAngle = noiseSample.mul(Math.PI * 2.0);
    const windDir = normalize(vec2(cos(windAngle), sin(windAngle)));

    // Some factor of how high up we are
    const y = positionLocal.y.div(float(0.75));
    const heightFactor = y.mul(y);
    const bendStrength = noiseSample.mul(float(0.3)).mul(heightFactor);

    // The actual bend offset in XZ plane
    const bendOffset = vec3(windDir.x, 0.0, windDir.y).mul(bendStrength);

    // Bent position
    return worldPos.add(bendOffset);
  });

  private createGrassInstances() {
    const geometry = this.createBladeGeometry();
    const material = new NewGrassMaterial({});
    material.positionNode = this.computeWindAnimation();
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
    offset.y = float(0);
    offset.z = offsetZ;

    const randomRotation = hash(instanceIndex.add(200))
      .mul(float(Math.PI * 2))
      .sub(float(Math.PI));

    const randomScale = hash(instanceIndex.add(100)).mul(0.5).add(0.75); // 0.75..1.25

    additional.x = randomRotation;
    additional.y = randomScale;
  })().compute(this.COUNT);

  private computeUpdate = Fn(() => {
    const currentOffset = this.offsetBuffer.element(instanceIndex);

    // currentOffset.x = currentOffset.x.add(this.uPlayerPos.x);
    // currentOffset.z = currentOffset.z.add(this.uPlayerPos.z);

    // const off = this.offsetBuffer.element(instanceIndex);

    // // "tileSize" and "halfTile"
    // const tileSize = float(this.TILE_SIZE);
    // const halfTile = float(this.HALF_TILE_SIZE);

    // // The player's position (continuous, no floor!)
    // const playerX = float(this.uPlayerPos.value.x);
    // const playerZ = float(this.uPlayerPos.value.z);

    // // The old center from last frame
    // const oldCenterX = float(this.uOldCenter.value.x);
    // const oldCenterZ = float(this.uOldCenter.value.z);

    // // Subtract the movement delta => effectively "following" the player
    // const dx = playerX.sub(oldCenterX);
    // const dz = playerZ.sub(oldCenterZ);

    // off.x = off.x.sub(dx);
    // off.z = off.z.sub(dz);

    // // Optionally wrap around so each offset always remains in [-half, half].
    // // If you do NOT want wrapping, comment out the next 4 lines:
    // off.x = off.x.sub(tileSize.mul(off.x.greaterThan(halfTile)));
    // off.x = off.x.add(tileSize.mul(off.x.lessThan(halfTile.negate())));
    // off.z = off.z.sub(tileSize.mul(off.z.greaterThan(halfTile)));
    // off.z = off.z.add(tileSize.mul(off.z.lessThan(halfTile.negate())));
  })().compute(this.COUNT);

  async update(state: State) {
    const { renderer, clock, player } = state;
    this.uTime.value = clock.getElapsedTime();
    this.uPlayerPos.value.copy(player.position);

    await renderer.computeAsync(this.computeUpdate);
  }
}
