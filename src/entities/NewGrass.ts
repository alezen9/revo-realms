import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
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
  vec4,
  vec2,
  texture,
  min,
  max,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import alphaTextureUrl from "/textures/test.webp?url";

const getConfig = () => {
  const BLADE_WIDTH = 0.075;
  const BLADE_HEIGHT = 1.25;
  const TILE_SIZE = 25;
  const BLADES_PER_SIDE = 100;

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
      TILE_SIZE * Math.sqrt(2), // diagonal
    ),
  };
};

const config = getConfig();

const getGridConfig = () => {
  const GRID_SIZE = 7; // STRICTLY odd numbers so there is a tile in the middle
  return {
    GRID_SIZE,
    GRID_HALF_SIZE: GRID_SIZE / 2,
    BLADES_PER_GRID_SIDE: GRID_SIZE * config.BLADES_PER_SIDE,
    COUNT: GRID_SIZE * GRID_SIZE * config.COUNT,
    SPACING: config.SPACING,
  };
};

const gridConfig = getGridConfig();

export default class Grass {
  private uDelta = uniform(new Vector2(0));
  private geometry: BufferGeometry;
  private material: GrassMaterial;
  private grassField: Group;

  constructor(scene: State["scene"]) {
    this.geometry = this.createBladeGeometry();
    this.material = new GrassMaterial({ uDelta: this.uDelta });

    this.grassField = this.createGrassGrid();
    scene.add(this.grassField);
  }

  private createGrassGrid() {
    const grid = new Group();
    const offsetXZ =
      gridConfig.GRID_HALF_SIZE * config.TILE_SIZE - config.TILE_HALF_SIZE;

    let i = 0;
    for (let rowIdx = 0; rowIdx < gridConfig.GRID_SIZE; rowIdx++) {
      for (let colIdx = 0; colIdx < gridConfig.GRID_SIZE; colIdx++) {
        const tile = this.createTile();
        const x = config.TILE_SIZE * colIdx - offsetXZ;
        const z = config.TILE_SIZE * rowIdx - offsetXZ;
        tile.onBeforeRender = (_, __, ___, ____, material: GrassMaterial) => {
          material.setTileOffsetAndIndex(x, z, i);
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

    const dx = player.position.x - this.grassField.position.x;
    const dz = player.position.z - this.grassField.position.z;

    this.uDelta.value.set(dx, dz);

    this.grassField.position.copy(player.position).setY(0);

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

  // per tile instance
  uTileOffset?: UniformType<Vector2>;
  uTileIndex?: UniformType<number>;
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

  // per tile instance
  uTileOffset: uniform(new Vector2(0, 0)),
  uTileIndex: uniform(0),
};

class GrassMaterial extends MeshBasicNodeMaterial {
  private _uniforms: Required<GrassUniforms>;
  private _tileBuffer: ReturnType<typeof instancedArray>; // x, z (y), yaw, scale
  private _gridBuffer: ReturnType<typeof instancedArray>; // current bending angle, original bending angle, opacity
  private _alphaTexture: Texture;

  constructor(uniforms: Pick<GrassUniforms, "uDelta">) {
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

  setTileOffsetAndIndex(x: number, z: number, idx: number) {
    this._uniforms.uTileOffset.value.set(x, z);
    this._uniforms.uTileIndex.value = idx;
  }

  private computeInitTile = Fn(() => {
    // Position
    const tileData = this._tileBuffer.element(instanceIndex);
    const row = floor(float(instanceIndex).div(config.BLADES_PER_SIDE));
    const col = float(instanceIndex).mod(config.BLADES_PER_SIDE);

    const randX = hash(instanceIndex);
    const randZ = hash(instanceIndex.add(1234));

    const offsetX = col
      .mul(config.SPACING)
      .sub(config.TILE_HALF_SIZE)
      .add(randX.mul(config.SPACING * 0.5)); // Randomness

    const offsetZ = row
      .mul(config.SPACING)
      .sub(config.TILE_HALF_SIZE)
      .add(randZ.mul(config.SPACING * 0.5)); // Randomness

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
    // Position
    const tileData = this._tileBuffer.element(instanceIndex);
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

    // Bending angle
    const minOffset = this._uniforms.uBladeMaxBendAngle.mul(0.05); // Small offset to avoid zero
    const randomBladeBend = hash(instanceIndex.add(300))
      .mul(this._uniforms.uBladeMaxBendAngle.mul(1.9)) // Slightly reduced range
      .sub(this._uniforms.uBladeMaxBendAngle.sub(minOffset)); // Shift away from 0

    gridData.x = randomBladeBend;
    gridData.y = randomBladeBend;
  })().compute(gridConfig.COUNT);

  private computeUpdateGrid = Fn(() => {
    const gridData = this._gridBuffer.element(instanceIndex);

    // Compute row and col in full grid
    const row = floor(
      float(instanceIndex).div(gridConfig.BLADES_PER_GRID_SIDE),
    );
    const col = float(instanceIndex).mod(gridConfig.BLADES_PER_GRID_SIDE);

    // Compute world-space position of each blade in the grid
    const worldPos = vec2(
      col
        .mul(config.SPACING)
        .sub(
          float(gridConfig.BLADES_PER_GRID_SIDE).mul(config.SPACING).mul(0.5),
        ),
      row
        .mul(config.SPACING)
        .sub(
          float(gridConfig.BLADES_PER_GRID_SIDE).mul(config.SPACING).mul(0.5),
        ),
    ).add(this._uniforms.uPlayerPosition.xz);

    // Normalize world position to texture UV space (assuming 256x256 texture)
    const uvPos = worldPos.div(float(256)).add(float(0.5));

    // Sample alpha texture
    const alphaValue = texture(this._alphaTexture, uvPos).r;

    // Store alpha in grid buffer
    gridData.z = alphaValue;
  })().compute(gridConfig.COUNT);

  private computePosition = Fn(
    ([tileData = vec4(0, 0, 0, 0), gridData = vec3(0, 0, 0)]) => {
      const combinedOffset = tileData.xy.add(this._uniforms.uTileOffset);
      const offset = vec3(combinedOffset.x, 0, combinedOffset.y);

      const bendingAngle = gridData.x;
      const scale = tileData.w;
      const yawAngle = tileData.z;

      // Compute bending strength based on vertex height
      const bendAmount = bendingAngle.mul(uv().y); // More bending at the top

      // Apply bending: Rotate around the X-axis to tilt forward/backward
      const bentPosition = rotate(positionLocal, vec3(bendAmount, 0, 0));

      // Apply scaling
      const scaled = positionLocal.mul(vec3(1, scale, 1));

      // Apply rotation
      const rotated = rotate(scaled, vec3(0, yawAngle, 0));

      // Final world position
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
    return blendedColor;
  });

  private computeGridInstanceIndex = Fn(([tileData = vec4(0, 0, 0, 0)]) => {
    // 1. Reconstruct final XY (2D) for each blade
    //   tileData.x,y + uTileOffset.x,y
    const tileOffset = this._uniforms.uTileOffset;
    const finalX = tileData.x.add(tileOffset.x);
    const finalZ = tileData.y.add(tileOffset.y);

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

    const tileData = this._tileBuffer.element(instanceIndex);
    const gridInstanceIndex = this.computeGridInstanceIndex(tileData);
    const gridData = this._gridBuffer.element(gridInstanceIndex);

    this.positionNode = this.computePosition(tileData, gridData);
    this.opacityNode = gridData.z;
    this.alphaTest = 0.1;
    this.aoNode = smoothstep(-0.75, 1.25, uv().y);
    this.colorNode = this.computeDiffuseColor();
  }

  async update(state: State) {
    const { renderer, player } = state;
    this._uniforms.uPlayerPosition.value.copy(player.position);
    await Promise.all([
      renderer.computeAsync(this.computeUpdateTile),
      renderer.computeAsync(this.computeUpdateGrid),
    ]);
  }
}
