import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Object3D,
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
  smoothstep,
  mod,
  vec2,
  texture,
  step,
  min,
  sin,
  fract,
  abs,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import alphaTextureUrl from "/textures/test.webp?url";

const getConfig = () => {
  const BLADE_WIDTH = 0.2;
  const BLADE_HEIGHT = 1.5;
  const TILE_SIZE = 50;
  const BLADES_PER_SIDE = 175;
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
    boundingSphere: new Sphere(
      new Vector3(0, 0, 0),
      (TILE_SIZE / 2) * Math.sqrt(2),
    ),
  };
};
const config = getConfig();

const getGridConfig = () => {
  const GRID_SIZE = 3; // BETTER IF odd number so player is at the center of the center tile and back tiles are culled out
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
  uTime?: UniformType<number>;
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
  uTileIdx?: UniformType<number>;
};

const defaultUniforms: Required<GrassUniforms> = {
  uTime: uniform(0),
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
  uTileIdx: uniform(0),
};

class GrassMaterial extends MeshBasicNodeMaterial {
  private _uniforms: Required<GrassUniforms>;
  private _gridBuffer1: ReturnType<typeof instancedArray>; // holds: vec4 = (localOffset.x, localOffset.y, yaw, bending angle)
  private _gridBuffer2: ReturnType<typeof instancedArray>; // holds: vec4 = (current scale, original scale, alpha, TBD)
  private _alphaTexture: Texture;
  constructor() {
    super();
    this._uniforms = defaultUniforms;
    this._gridBuffer1 = instancedArray(gridConfig.COUNT, "vec4");
    this._gridBuffer1.setPBO(true);
    this._gridBuffer2 = instancedArray(gridConfig.COUNT, "vec4");
    this._gridBuffer2.setPBO(true);
    this._alphaTexture = assetManager.textureLoader.load(alphaTextureUrl);
    this._alphaTexture.flipY = false;

    this.computeUpdate.onInit(({ renderer }) => {
      renderer.computeAsync(this.computeInit);
    });
    this.createGrassMaterial();
  }

  setTileIndex(idx: number) {
    this._uniforms.uTileIdx.value = idx;
  }

  setDelta(dx: number, dz: number) {
    this._uniforms.uDelta.value.set(dx, dz);
  }

  private computeInit = Fn(() => {
    const gridData = this._gridBuffer1.element(instanceIndex);
    // Position XZ
    const row = floor(
      float(instanceIndex).div(gridConfig.BLADES_PER_GRID_SIDE),
    );
    const col = float(instanceIndex).mod(gridConfig.BLADES_PER_GRID_SIDE);

    const randX = hash(instanceIndex).add(4321);
    const randZ = hash(instanceIndex.add(1234));
    const offsetX = col
      .mul(gridConfig.SPACING)
      .sub(gridConfig.GRID_HALF_WIDTH)
      .add(randX.mul(gridConfig.SPACING * 0.5));
    const offsetZ = row
      .mul(gridConfig.SPACING)
      .sub(gridConfig.GRID_HALF_WIDTH)
      .add(randZ.mul(gridConfig.SPACING * 0.5));
    gridData.x = offsetX;
    gridData.y = offsetZ;

    const noiseUV = vec2(gridData.x, gridData.y)
      .div(gridConfig.GRID_HALF_WIDTH)
      .add(1);
    const noiseScale = float(1);
    const uv = fract(noiseUV.mul(noiseScale));
    const noiseValue = texture(assetManager.randomNoiseTexture, uv).r;

    // Yaw
    const yawVariation = noiseValue.sub(0.5).mul(float(Math.PI)); // Map noise to [-PI/2, PI/2]
    gridData.z = yawVariation;

    // Scale
    const gridData2 = this._gridBuffer2.element(instanceIndex);
    const scaleRange = this._uniforms.uBladeMaxScale.sub(
      this._uniforms.uBladeMinScale,
    );
    const randomScale = hash(instanceIndex.add(100))
      .mul(scaleRange)
      .add(this._uniforms.uBladeMinScale);

    gridData2.x = randomScale;
    gridData2.y = randomScale;
  })().compute(gridConfig.COUNT);

  private computeUpdate = Fn(() => {
    const gridData = this._gridBuffer1.element(instanceIndex);
    // Position
    const newOffsetX = mod(
      gridData.x.sub(this._uniforms.uDelta.x).add(gridConfig.GRID_HALF_WIDTH),
      gridConfig.GRID_WIDTH,
    ).sub(gridConfig.GRID_HALF_WIDTH);
    const newOffsetZ = mod(
      gridData.y.sub(this._uniforms.uDelta.y).add(gridConfig.GRID_HALF_WIDTH),
      gridConfig.GRID_WIDTH,
    ).sub(gridConfig.GRID_HALF_WIDTH);

    gridData.x = newOffsetX;
    gridData.y = newOffsetZ;

    const gridPos = vec2(gridData.x, gridData.y);

    // Wind
    const windUV = gridPos
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

    // gridData.w = mix(gridData.w, targetBendAngle, 0.1); // 0.1 = smoothing factor
    gridData.w = gridData.w.add(targetBendAngle.sub(gridData.w).mul(0.1));

    // Update alpha
    const gridData2 = this._gridBuffer2.element(instanceIndex);
    const mapSize = float(256);
    const worldPos = gridPos
      .add(this._uniforms.uPlayerPosition.xz)
      .add(mapSize.mul(0.5))
      .div(mapSize);
    const alphaValue = texture(this._alphaTexture, worldPos).r;
    gridData2.z = alphaValue;

    // Trail
    // Compute distance to player
    const playerPos = vec2(this._uniforms.uDelta.x, this._uniforms.uDelta.y);
    const diff = gridPos.sub(playerPos);
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
    const growScale = gridData2.x.add(this._uniforms.uTrailGrowthRate);

    // Compute new scale
    const growScaleFactor = float(1).sub(isBladeSteppedOn);
    const targetScale = this._uniforms.uTrailMinScale
      .mul(isBladeSteppedOn)
      .add(growScale.mul(growScaleFactor));

    gridData2.x = min(targetScale, gridData2.y);
  })().compute(gridConfig.COUNT);

  private computePosition = Fn(
    ([data1 = vec4(0, 0, 0, 0), data2 = vec3(0, 0, 0)]) => {
      const combinedOffset = data1.xy;
      const offset = vec3(combinedOffset.x, 0, combinedOffset.y);
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

  private computeDiffuseColor = Fn(() => {
    const verticalFactor = pow(uv().y, 1.5);
    const baseToTip = mix(
      this._uniforms.uBaseColor,
      this._uniforms.uTipColor,
      verticalFactor,
    );

    const colorVariation = hash(instanceIndex).mul(0.05).sub(0.025);
    return baseToTip.add(colorVariation);
  });

  private computeAO = Fn(() => {
    const sideAO = abs(sin(this._gridBuffer1.element(instanceIndex).z)).mul(
      0.5,
    );
    const verticalAO = smoothstep(-0.75, 1.25, uv().y);
    return verticalAO.mul(float(1.0).sub(sideAO));
  });

  private computeGridIndex = Fn(([tileIdx = float(0), bladeIdx = float(0)]) => {
    // Compute the tile's row and column
    const tileRow = floor(tileIdx.div(gridConfig.GRID_SIZE));
    const tileCol = tileIdx.mod(gridConfig.GRID_SIZE);

    // Compute the object's row and column within the tile
    const objRow = floor(bladeIdx.div(config.BLADES_PER_SIDE));
    const objCol = bladeIdx.mod(config.BLADES_PER_SIDE);

    // Compute global row and column
    const globalRow = tileRow.mul(config.BLADES_PER_SIDE).add(objRow);
    const globalCol = tileCol.mul(config.BLADES_PER_SIDE).add(objCol);

    // Compute final global index
    return globalRow.mul(gridConfig.BLADES_PER_GRID_SIDE).add(globalCol);
  });

  private createGrassMaterial() {
    this.precision = "lowp";
    this.side = DoubleSide;
    const bladeIdx = float(instanceIndex);
    const tileIdx = this._uniforms.uTileIdx;
    const gridIdx = this.computeGridIndex(tileIdx, bladeIdx);
    const data1 = this._gridBuffer1.element(gridIdx);
    const data2 = this._gridBuffer2.element(gridIdx);
    this.positionNode = this.computePosition(data1, data2);
    this.opacityNode = data2.z;
    this.alphaTest = 0.1;
    this.aoNode = this.computeAO();
    this.colorNode = this.computeDiffuseColor();
  }

  async update(state: State) {
    const { renderer, player, clock } = state;
    this._uniforms.uTime.value = clock.getElapsedTime();
    this._uniforms.uPlayerPosition.value.copy(player.position);
    await renderer.computeAsync(this.computeUpdate);
  }
}

export default class Grass {
  private geometry: BufferGeometry;
  private material: GrassMaterial;
  private grassField: Group;

  constructor(scene: State["scene"]) {
    this.geometry = this.createBladeGeometry();
    this.material = new GrassMaterial();
    this.grassField = this.createGrassGrid();
    scene.add(this.grassField);
  }

  private onBeforeRenderTile =
    (tileIdx: number): Object3D["onBeforeRender"] =>
    (_, __, ___, ____, material: GrassMaterial) => {
      material.setTileIndex(tileIdx);
    };

  private createGrassGrid() {
    const grid = new Group();
    let i = 0;
    for (let row = 0; row < gridConfig.GRID_SIZE; row++) {
      for (let col = 0; col < gridConfig.GRID_SIZE; col++) {
        const tile = this.createTile();
        tile.onBeforeRender = this.onBeforeRenderTile(i);
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

  // private createBladeGeometryLow() {
  //   const halfWidth = config.BLADE_WIDTH / 2;
  //   const height = config.BLADE_HEIGHT;
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
  //   const geometry = new BufferGeometry();
  //   geometry.setAttribute("position", new BufferAttribute(positions, 3));
  //   geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  //   return geometry;
  // }

  private createBladeGeometry() {
    //    E
    //   /  \
    //  C----D
    // |  \   |
    // A------B
    const halfWidth = config.BLADE_WIDTH / 2;
    const quarterWidth = halfWidth / 2;
    const segmentHeight = config.BLADE_HEIGHT / 2;
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

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setIndex(new BufferAttribute(indices, 1));
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
