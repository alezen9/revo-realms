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
  mod, // note: ensure this mod returns a positive remainder
  vec4,
  vec2,
  texture,
  min,
  max,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import alphaTextureUrl from "/textures/test.webp?url";

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const getConfig = () => {
  const BLADE_WIDTH = 0.075;
  const BLADE_HEIGHT = 1.25;
  const TILE_SIZE = 15;
  const BLADES_PER_SIDE = 75;

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
    boundingSphere: new Sphere(new Vector3(0, 0, 0), TILE_SIZE * Math.sqrt(2)),
  };
};

const config = getConfig();

const getGridConfig = () => {
  const GRID_SIZE = 11; // must be an odd number so there is a center tile.
  return {
    GRID_SIZE,
    GRID_HALF_SIZE: GRID_SIZE / 2,
    BLADES_PER_GRID_SIDE: GRID_SIZE * config.BLADES_PER_SIDE,
    COUNT: GRID_SIZE * GRID_SIZE * config.COUNT,
    SPACING: config.SPACING,
  };
};

const gridConfig = getGridConfig();

// -----------------------------------------------------------------------------
// Grass Class: Creates a grid of tiles, each of which is an instanced mesh.
// The grid is not moved per se; instead, in update() we reposition the grid so that
// its center tile is aligned with the player’s current tile and update a wrap offset.
// -----------------------------------------------------------------------------

export default class Grass {
  private geometry: BufferGeometry;
  private material: GrassMaterial;
  private grassField: Group;

  constructor(scene: State["scene"]) {
    this.geometry = this.createBladeGeometry();
    this.material = new GrassMaterial();

    this.grassField = this.createGrassGrid();
    // We leave the grassField at the origin; its position will be updated in update().
    scene.add(this.grassField);
  }

  private createGrassGrid() {
    const grid = new Group();
    const centerIdx = Math.floor(gridConfig.GRID_SIZE / 2);
    let i = 0;
    for (let rowIdx = 0; rowIdx < gridConfig.GRID_SIZE; rowIdx++) {
      for (let colIdx = 0; colIdx < gridConfig.GRID_SIZE; colIdx++) {
        const tile = this.createTile();
        // Compute a static offset for the tile relative to the grid center.
        const tileOffsetX = (colIdx - centerIdx) * config.TILE_SIZE;
        const tileOffsetZ = (rowIdx - centerIdx) * config.TILE_SIZE;
        // onBeforeRender is called every frame for visible objects.
        // Here we pass the tile’s static offset and a tile index.
        tile.onBeforeRender = (_, __, ___, ____, material: GrassMaterial) => {
          material.setTileOffsetAndIndex(tileOffsetX, tileOffsetZ, i);
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
    const tileSize = config.TILE_SIZE;
    // const gridCenter = Math.floor(gridConfig.GRID_SIZE / 2);

    // Compute the player's current tile coordinate.
    const playerTileX = Math.floor(player.position.x / tileSize);
    const playerTileZ = Math.floor(player.position.z / tileSize);
    // Compute the fractional offset within the current tile.
    const fracX = player.position.x - playerTileX * tileSize;
    const fracZ = player.position.z - playerTileZ * tileSize;

    // Reposition the grid so its center tile corresponds to the player's current tile.
    // const gridPosX = playerTileX * tileSize - gridCenter * tileSize;
    // const gridPosZ = playerTileZ * tileSize - gridCenter * tileSize;
    // this.grassField.position.set(gridPosX, 0, gridPosZ);
    this.grassField.position.copy(player.position).setY(0);

    // Update the per-frame wrap offset so the grass appears to slide within each tile.
    this.material._uniforms.uTileWrapOffset.value.set(-fracX, -fracZ);

    // Update other uniforms (if used by compute nodes).
    this.material._uniforms.uPlayerPosition.value.copy(player.position);

    await this.material.update(state);
  }
}

// -----------------------------------------------------------------------------
// Uniforms & Defaults
// -----------------------------------------------------------------------------

type UniformType<T> = ReturnType<typeof uniform<T>>;

type GrassUniforms = {
  // Compute uniforms
  uPlayerPosition?: UniformType<Vector3>;
  uBladeMinScale?: UniformType<number>;
  uBladeMaxScale?: UniformType<number>;
  uTrailGrowthRate?: UniformType<number>;
  uTrailMinScale?: UniformType<number>;
  uTrailRaius?: UniformType<number>;
  uTrailRaiusSquared?: UniformType<number>;
  uBladeMaxBendAngle?: UniformType<number>;

  // Color uniforms
  uBaseColor?: UniformType<Color>;
  uTipColor?: UniformType<Color>;

  // Per-tile instance – static offset (set via onBeforeRender)
  uTileOffset?: UniformType<Vector2>;
  // Additional per-frame wrap offset (computed in update)
  uTileWrapOffset?: UniformType<Vector2>;
  uTileIndex?: UniformType<number>;
};

const defaultUniforms: Required<GrassUniforms> = {
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
  uTileWrapOffset: uniform(new Vector2(0, 0)),
  uTileIndex: uniform(0),
};

// -----------------------------------------------------------------------------
// GrassMaterial: Handles compute nodes and the final shader composition.
// The final blade world position is computed as:
//   bladeLocalOffset (from computeInitTile) + uTileOffset (static per-tile) + uTileWrapOffset (dynamic)
// -----------------------------------------------------------------------------

class GrassMaterial extends MeshBasicNodeMaterial {
  // (Exposed publicly for convenience. In a production system, you might encapsulate these.)
  public _uniforms: Required<GrassUniforms>;
  private _tileBuffer: ReturnType<typeof instancedArray>; // holds: x,y (local offset), yaw, scale
  private _gridBuffer: ReturnType<typeof instancedArray>; // grid data (for bending, alpha, etc.)
  private _alphaTexture: Texture;

  constructor() {
    super();
    this._uniforms = { ...defaultUniforms };

    this._tileBuffer = instancedArray(config.COUNT, "vec4");
    this._tileBuffer.setPBO(true);

    this._gridBuffer = instancedArray(gridConfig.COUNT, "vec3");
    this._gridBuffer.setPBO(true);

    this._alphaTexture = assetManager.textureLoader.load(alphaTextureUrl);
    this._alphaTexture.flipY = false;

    // Run the initial compute passes.
    // Here we schedule the initial per-blade and grid initializations.
    this.computeUpdateGrid.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInitTile);
      renderer.computeAsync(this.computeInitGrid);
    });

    this.createGrassMaterial();
  }

  // Called per tile (via onBeforeRender) to set the static per-tile offset and index.
  setTileOffsetAndIndex(x: number, z: number, idx: number) {
    this._uniforms.uTileOffset.value.set(x, z);
    this._uniforms.uTileIndex.value = idx;
  }

  // ---------------------------------------------------------------------------
  // Compute Node: Initialize per-blade data (local offset, yaw, scale) once.
  // ---------------------------------------------------------------------------
  private computeInitTile = Fn(() => {
    const tileData = this._tileBuffer.element(instanceIndex);
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

    // Yaw: Give each blade a random rotation.
    const randomBladeYaw = hash(instanceIndex.add(200))
      .mul(float(Math.PI * 2))
      .sub(float(Math.PI));
    tileData.z = randomBladeYaw;

    // Scale: Randomize the blade’s scale.
    const scaleRange = this._uniforms.uBladeMaxScale.sub(
      this._uniforms.uBladeMinScale,
    );
    const randomScale = hash(instanceIndex.add(100))
      .mul(scaleRange)
      .add(this._uniforms.uBladeMinScale);
    tileData.w = randomScale;
  })().compute(config.COUNT);

  // ---------------------------------------------------------------------------
  // Compute Node: Initialize grid data for bending (run once).
  // ---------------------------------------------------------------------------
  private computeInitGrid = Fn(() => {
    const gridData = this._gridBuffer.element(instanceIndex);
    const minOffset = this._uniforms.uBladeMaxBendAngle.mul(0.05);
    const randomBladeBend = hash(instanceIndex.add(300))
      .mul(this._uniforms.uBladeMaxBendAngle.mul(1.9))
      .sub(this._uniforms.uBladeMaxBendAngle.sub(minOffset));
    gridData.x = randomBladeBend;
    gridData.y = randomBladeBend;
  })().compute(gridConfig.COUNT);

  // ---------------------------------------------------------------------------
  // Compute Node: Update grid data (such as alpha values) each frame.
  // ---------------------------------------------------------------------------
  private computeUpdateGrid = Fn(() => {
    const gridData = this._gridBuffer.element(instanceIndex);
    const row = floor(
      float(instanceIndex).div(gridConfig.BLADES_PER_GRID_SIDE),
    );
    const col = float(instanceIndex).mod(gridConfig.BLADES_PER_GRID_SIDE);

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

    const uvPos = worldPos.div(float(256)).add(float(0.5));
    const alphaValue = texture(this._alphaTexture, uvPos).r;
    gridData.z = alphaValue;
  })().compute(gridConfig.COUNT);

  // ---------------------------------------------------------------------------
  // Compute Node: Final blade position.
  // Combines the constant blade local offset, the static tile offset, and the dynamic wrap offset.
  // ---------------------------------------------------------------------------
  private computePosition = Fn(
    ([tileData = vec4(0, 0, 0, 0), gridData = vec3(0, 0, 0)]) => {
      const combinedOffset = tileData.xy
        .add(this._uniforms.uTileOffset)
        .add(this._uniforms.uTileWrapOffset);
      const offset = vec3(combinedOffset.x, 0, combinedOffset.y);

      const bendingAngle = gridData.x;
      const scale = tileData.w;
      const yawAngle = tileData.z;

      const bendAmount = bendingAngle.mul(uv().y);
      const bentPosition = rotate(positionLocal, vec3(bendAmount, 0, 0));
      const scaled = bentPosition.mul(vec3(1, scale, 1));
      const rotated = rotate(scaled, vec3(0, yawAngle, 0));
      const worldPosition = rotated.add(offset);
      return worldPosition;
    },
  );

  // ---------------------------------------------------------------------------
  // Compute Node: Compute diffuse color.
  // ---------------------------------------------------------------------------
  private computeDiffuseColor = Fn(() => {
    const factor = pow(uv().y, 1.5);
    const blendedColor = mix(
      this._uniforms.uBaseColor,
      this._uniforms.uTipColor,
      factor,
    );
    return blendedColor;
  });

  // ---------------------------------------------------------------------------
  // Compute Node: Compute the grid instance index (used for sampling grid data).
  // ---------------------------------------------------------------------------
  private computeGridInstanceIndex = Fn(([tileData = vec4(0, 0, 0, 0)]) => {
    const tileOffset = this._uniforms.uTileOffset;
    const finalX = tileData.x.add(tileOffset.x);
    const finalZ = tileData.y.add(tileOffset.y);

    const halfField = float(gridConfig.BLADES_PER_GRID_SIDE)
      .mul(config.SPACING)
      .mul(0.5);

    const colGrid = floor(finalX.add(halfField).div(config.SPACING));
    const rowGrid = floor(finalZ.add(halfField).div(config.SPACING));

    const colClamped = min(
      max(colGrid, float(0)),
      float(gridConfig.BLADES_PER_GRID_SIDE - 1),
    );
    const rowClamped = min(
      max(rowGrid, float(0)),
      float(gridConfig.BLADES_PER_GRID_SIDE - 1),
    );

    const gridIndex = rowClamped
      .mul(float(gridConfig.BLADES_PER_GRID_SIDE))
      .add(colClamped);
    return gridIndex;
  });

  // ---------------------------------------------------------------------------
  // Create the material by setting up the node chain.
  // ---------------------------------------------------------------------------
  private createGrassMaterial() {
    this.precision = "lowp";
    this.side = DoubleSide;
    this.toneMapped = false;

    const tileData = this._tileBuffer.element(instanceIndex);
    const gridInstanceIndex = this.computeGridInstanceIndex(tileData);
    const gridData = this._gridBuffer.element(gridInstanceIndex);

    this.positionNode = this.computePosition(tileData, gridData);
    // Optionally, if alpha testing or opacity is desired, uncomment these lines:
    this.opacityNode = gridData.z;
    this.alphaTest = 0.1;
    this.aoNode = smoothstep(-0.75, 1.25, uv().y);
    this.colorNode = this.computeDiffuseColor();
  }

  async update(state: State) {
    const { renderer } = state;
    await renderer.computeAsync(this.computeUpdateGrid);
  }
}
