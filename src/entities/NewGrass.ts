import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  MathUtils,
  Sphere,
  Texture,
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
  mod,
  texture,
  smoothstep,
  min,
  max,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import alphaTextureUrl from "/textures/test.webp?url";

const getConfig = () => {
  const BLADE_WIDTH = 0.25;
  const BLADE_HEIGHT = 1.75;
  const TILE_SIZE = 50;
  const BLADES_PER_SIDE = 75;
  return {
    BLADE_WIDTH,
    BLADE_HEIGHT,
    TILE_SIZE,
    TILE_HALF_SIZE: TILE_SIZE / 2,
    BLADES_PER_SIDE,
    COUNT: BLADES_PER_SIDE * BLADES_PER_SIDE, // blades per tile
    SPACING: TILE_SIZE / BLADES_PER_SIDE,
    boundingBox: new Box3(
      new Vector3(-TILE_SIZE / 2, 0, -TILE_SIZE / 2),
      new Vector3(TILE_SIZE / 2, BLADE_HEIGHT * 2, TILE_SIZE / 2),
    ),
    boundingSphere: new Sphere(new Vector3(0, 0, 0), TILE_SIZE * Math.sqrt(2)),
  };
};
const config = getConfig();

const getGridConfig = () => {
  const GRID_SIZE = 3; // STRICT: odd number so player is at the center of the center tile
  return {
    GRID_SIZE,
    GRID_WIDTH: GRID_SIZE * config.TILE_SIZE,
    GRID_HALF_WIDTH: (GRID_SIZE * config.TILE_SIZE) / 2,
    COUNT: GRID_SIZE * GRID_SIZE * config.COUNT,
    BLADES_PER_GRID_SIDE: GRID_SIZE * config.BLADES_PER_SIDE,
    SPACING: config.SPACING,
  };
};
const gridConfig = getGridConfig();

type UniformType<T> = ReturnType<typeof uniform<T>>;
type GrassUniforms = {
  uDelta: UniformType<Vector2>;
  uPlayerPosition?: UniformType<Vector3>;
  uBladeMinScale?: UniformType<number>;
  uBladeMaxScale?: UniformType<number>;
  uTrailGrowthRate?: UniformType<number>;
  uTrailMinScale?: UniformType<number>;
  uTrailRaius?: UniformType<number>;
  uTrailRaiusSquared?: UniformType<number>;
  uBladeMaxBendAngle?: UniformType<number>;
  uBaseColor?: UniformType<Color>;
  uTipColor?: UniformType<Color>;
  // Per-tile uniforms:
  uTileOffset?: UniformType<Vector2>;
  uTileColorVarianceFactor?: UniformType<number>;
};

const defaultUniforms: Required<GrassUniforms> = {
  uDelta: uniform(new Vector2(0, 0)),
  uPlayerPosition: uniform(new Vector3(0, 0, 0)),
  uBladeMinScale: uniform(0.5),
  uBladeMaxScale: uniform(1.25),
  uTrailGrowthRate: uniform(0.004),
  uTrailMinScale: uniform(0.1),
  uTrailRaius: uniform(0.65),
  uTrailRaiusSquared: uniform(0.65 * 0.65),
  uBladeMaxBendAngle: uniform(Math.PI * 0.15),
  uBaseColor: uniform(new Color("#4f8a4f")),
  uTipColor: uniform(new Color("#f7ff3d")),
  uTileOffset: uniform(new Vector2(0, 0)),

  uTileColorVarianceFactor: uniform(1),
};

class GrassMaterial extends MeshBasicNodeMaterial {
  private _uniforms: Required<GrassUniforms>;
  private _tileBuffer: ReturnType<typeof instancedArray>; // holds: vec4 = (localOffset.x, localOffset.y, yaw, scale)
  private _gridBuffer: ReturnType<typeof instancedArray>; // holds: vec3 = (initial bending, trail bending, alpha)
  private _alphaTexture: Texture;
  constructor(uniforms: GrassUniforms) {
    super();
    this._uniforms = { ...defaultUniforms, ...uniforms };
    this._tileBuffer = instancedArray(config.COUNT, "vec4");
    this._tileBuffer.setPBO(true);
    this._gridBuffer = instancedArray(gridConfig.COUNT, "vec3");
    this._gridBuffer.setPBO(true);
    this._alphaTexture = assetManager.textureLoader.load(alphaTextureUrl);
    this._alphaTexture.flipY = false;

    this.computeUpdateTile.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInitTile);
    });
    this.computeUpdateGrid.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInitGrid);
    });
    this.createGrassMaterial();
  }

  setTileOffset(x: number, z: number) {
    this._uniforms.uTileOffset.value.set(x, z);
  }

  setRandomColorVariance(n: number) {
    this._uniforms.uTileColorVarianceFactor.value = n;
  }

  private computeInitTile = Fn(() => {
    const tileData = this._tileBuffer.element(instanceIndex);

    // Position XZ
    const row = floor(float(instanceIndex).div(config.BLADES_PER_SIDE));
    const col = float(instanceIndex).mod(config.BLADES_PER_SIDE);
    const randX = hash(instanceIndex);
    const randZ = hash(instanceIndex.add(1234));
    const offsetX = col
      .mul(config.SPACING)
      .sub(config.TILE_HALF_SIZE)
      .add(randX.mul(config.SPACING * 0.5));
    const offsetZ = row
      .mul(config.SPACING)
      .sub(config.TILE_HALF_SIZE)
      .add(randZ.mul(config.SPACING * 0.5));
    tileData.x = offsetX;
    tileData.y = offsetZ;

    // Yaw
    const randomBladeYaw = hash(instanceIndex.add(200))
      .mul(float(Math.PI * 2))
      .sub(float(Math.PI));
    tileData.z = randomBladeYaw;

    // Scale
    const scaleRange = this._uniforms.uBladeMaxScale.sub(
      this._uniforms.uBladeMinScale,
    );
    const randomScale = hash(instanceIndex.add(100))
      .mul(scaleRange)
      .add(this._uniforms.uBladeMinScale);
    tileData.w = randomScale;
  })().compute(config.COUNT);

  private computeUpdateTile = Fn(() => {
    const tileData = this._tileBuffer.element(instanceIndex);
    // Position
    const newOffsetX = mod(
      tileData.x.sub(this._uniforms.uDelta.x).add(config.TILE_HALF_SIZE),
      config.TILE_SIZE,
    ).sub(config.TILE_HALF_SIZE);
    const newOffsetZ = mod(
      tileData.y.sub(this._uniforms.uDelta.y).add(config.TILE_HALF_SIZE),
      config.TILE_SIZE,
    ).sub(config.TILE_HALF_SIZE);

    tileData.x = newOffsetX;
    tileData.y = newOffsetZ;
  })().compute(config.COUNT);

  private computeInitGrid = Fn(() => {
    const gridData = this._gridBuffer.element(instanceIndex);
    // Bending
    const randomBladeBend = hash(instanceIndex.add(300))
      .mul(this._uniforms.uBladeMaxBendAngle.mul(2))
      .sub(this._uniforms.uBladeMaxBendAngle);

    gridData.x = randomBladeBend;
    gridData.y = randomBladeBend;
  })().compute(gridConfig.COUNT);

  private computeUpdateGrid = Fn(() => {
    // const tileData2 = this._tileBuffer2.element(instanceIndex);
    // // Alpha
    // const mapSize = float(256);
    // const worldPosition = this._uniforms.uPlayerPosition.xz.add(
    //   newOffsetX,
    //   newOffsetZ,
    // );
    // const uv = worldPosition.add(mapSize.div(2)).div(mapSize);
    // const alphaValue = texture(this._alphaTexture, uv).r;
    // tileData2.z = alphaValue;
  })().compute(gridConfig.COUNT);

  private computePosition = Fn(
    ([data1 = vec4(0, 0, 0, 0), data2 = vec3(0, 0, 0)]) => {
      const combinedOffset = data1.xy.add(this._uniforms.uTileOffset);
      const offset = vec3(combinedOffset.x, 0, combinedOffset.y);
      const scale = data1.w;
      const yawAngle = data1.z;
      const bendingAngle = data2.x;
      const bendAmount = bendingAngle.mul(uv().y);
      const bentPosition = rotate(positionLocal, vec3(bendAmount, 0, 0));
      const scaled = bentPosition.mul(vec3(1, scale, 1));
      const rotated = rotate(scaled, vec3(0, yawAngle, 0));
      const worldPosition = rotated.add(offset);
      return worldPosition;
    },
  );

  private computeDiffuseColor = Fn(() => {
    const factor = pow(uv().y, 1.5);
    const blendedColor = mix(
      this._uniforms.uBaseColor,
      this._uniforms.uTipColor,
      factor,
    );
    return blendedColor.mul(this._uniforms.uTileColorVarianceFactor);
  });

  private computeGridInstanceIndex = Fn(([data1 = vec4(0, 0, 0, 0)]) => {
    // 1. Reconstruct final XY (2D) for each blade
    //   tileData.x,y + uTileOffset.x,y
    const tileOffset = this._uniforms.uTileOffset;
    const finalX = data1.x.add(tileOffset.x);
    const finalZ = data1.y.add(tileOffset.y);

    // 2. Map finalX, finalZ to global row/col
    const halfField = float(gridConfig.BLADES_PER_GRID_SIDE)
      .mul(config.SPACING)
      .mul(0.5);

    const colGrid = floor(finalX.add(halfField).div(config.SPACING));
    const rowGrid = floor(finalZ.add(halfField).div(config.SPACING));

    // 3. clamp (optional)
    const colClamped = min(
      max(colGrid, float(0)),
      float(gridConfig.BLADES_PER_GRID_SIDE - 1),
    );
    const rowClamped = min(
      max(rowGrid, float(0)),
      float(gridConfig.BLADES_PER_GRID_SIDE - 1),
    );

    // 4. final gridIndex
    const gridIndex = rowClamped
      .mul(float(gridConfig.BLADES_PER_GRID_SIDE))
      .add(colClamped);

    return gridIndex;
  });

  private createGrassMaterial() {
    this.precision = "lowp";
    this.side = DoubleSide;
    this.toneMapped = false;
    const data1 = this._tileBuffer.element(instanceIndex);
    const gridIndex = this.computeGridInstanceIndex(data1);
    const data2 = this._gridBuffer.element(gridIndex);
    this.positionNode = this.computePosition(data1, data2);
    // this.opacityNode = data2.z;
    // this.alphaTest = 0.1;
    this.aoNode = smoothstep(-0.75, 1.25, uv().y);
    // this.colorNode = this.computeDiffuseColor();
  }

  async update(state: State) {
    const { renderer } = state;
    await Promise.all([
      renderer.computeAsync(this.computeUpdateTile),
      renderer.computeAsync(this.computeUpdateGrid),
    ]);
  }
}

export default class Grass {
  private geometry: BufferGeometry;
  private material: GrassMaterial;
  private grassField: Group;

  private uDelta = uniform(new Vector2(0, 0));
  private uPlayerPosition = uniform(new Vector3(0, 0, 0));

  constructor(scene: State["scene"]) {
    this.geometry = this.createBladeGeometry();
    this.material = new GrassMaterial({
      uDelta: this.uDelta,
      uPlayerPosition: this.uPlayerPosition,
    });
    this.grassField = this.createGrassGrid();
    scene.add(this.grassField);
  }

  private createGrassGrid() {
    const grid = new Group();
    const centerIdx = Math.floor(gridConfig.GRID_SIZE / 2);
    let i = 0;
    for (let row = 0; row < gridConfig.GRID_SIZE; row++) {
      for (let col = 0; col < gridConfig.GRID_SIZE; col++) {
        const tile = this.createTile();
        const x = (col - centerIdx) * config.TILE_SIZE;
        const z = (row - centerIdx) * config.TILE_SIZE;

        const f = MathUtils.randFloat(0, 1);
        tile.onBeforeRender = (_, __, ___, ____, material: GrassMaterial) => {
          material.setTileOffset(x, z);
          material.setRandomColorVariance(f);
        };
        grid.add(tile);
        i++;
      }
    }
    return grid;
  }

  private createTile() {
    const instances = new InstancedMesh(
      this.geometry,
      this.material,
      config.COUNT,
    );
    instances.boundingBox = config.boundingBox;
    instances.boundingSphere = config.boundingSphere;
    return instances;
  }

  private createBladeGeometry() {
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
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    return geometry;
  }

  async update(state: State) {
    const { player } = state;
    const dx = player.position.x - this.grassField.position.x;
    const dz = player.position.z - this.grassField.position.z;
    this.uDelta.value.set(dx, dz);

    this.grassField.position.copy(player.position).setY(0);
    this.uPlayerPosition.value.copy(player.position);

    await this.material.update(state);
  }
}
