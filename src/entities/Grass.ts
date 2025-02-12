import {
  Box3,
  BoxHelper,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Sphere,
  SphereGeometry,
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
  max,
  clamp,
} from "three/tsl";
import { MeshLambertNodeMaterial } from "three/webgpu";
import { assetManager } from "../systems/AssetManager";
import alphaTextureUrl from "/textures/test.webp?url";

const getConfig = () => {
  const BLADE_WIDTH = 0.15;
  const BLADE_HEIGHT = 1.5;
  const TILE_SIZE = 50;
  const BLADES_PER_SIDE = 150;
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
    getBoundingBox: (x: number, z: number) => {
      const halfSize = TILE_SIZE / 2;
      return new Box3(
        new Vector3(-halfSize + x, 0, -halfSize + z),
        new Vector3(halfSize + x, BLADE_HEIGHT * 2, halfSize + z),
      );
    },
    // boundingSphere: new Sphere(
    //   new Vector3(0, 0, 0),
    //   (TILE_SIZE / 2) * Math.sqrt(2),
    // ),
    getBoundingSphere: (x: number, z: number) => {
      const radius = (TILE_SIZE / 2) * Math.sqrt(2);
      const threshold = TILE_SIZE / 2;
      return new Sphere(new Vector3(x, 0, z), radius + threshold);
    },
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
  uTileIdx?: UniformType<number>; // Per-tile uniforms
  uDelta: UniformType<Vector2>;
  uTileOffset?: UniformType<Vector2>;
  uTileColor?: UniformType<Color>;
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
  uTipColor: uniform(new Color("#f7ff3d")),
  // Updated externally
  uTileIdx: uniform(0),
  uDelta: uniform(new Vector2(0, 0)),
  uTileOffset: uniform(new Vector2(0, 0)),
  uTileColor: uniform(new Color()),
};

class GrassMaterial extends MeshLambertNodeMaterial {
  _uniforms: Required<GrassUniforms>;
  private _gridBuffer1: ReturnType<typeof instancedArray>; // holds: vec4 = (localOffset.x, localOffset.y, yaw, bending angle)
  private _gridBuffer2: ReturnType<typeof instancedArray>; // holds: vec4 = (current scale, original scale, alpha, glow)
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

  setTileColor(c: string) {
    this._uniforms.uTileColor.value.set(c);
  }

  setTileOffset(x: number, z: number) {
    this._uniforms.uTileOffset.value.set(x, z);
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

    const randX = hash(instanceIndex.add(4321));
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
    // // Position
    // const newOffsetX = mod(
    //   gridData.x.sub(this._uniforms.uDelta.x).add(gridConfig.GRID_HALF_WIDTH),
    //   gridConfig.GRID_WIDTH,
    // ).sub(gridConfig.GRID_HALF_WIDTH);
    // const newOffsetZ = mod(
    //   gridData.y.sub(this._uniforms.uDelta.y).add(gridConfig.GRID_HALF_WIDTH),
    //   gridConfig.GRID_WIDTH,
    // ).sub(gridConfig.GRID_HALF_WIDTH);

    // gridData.x = newOffsetX;
    // gridData.y = newOffsetZ;

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

    gridData.w = gridData.w.add(targetBendAngle.sub(gridData.w).mul(0.1));

    // Alpha
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

    // Scale
    const growScaleFactor = float(1).sub(isBladeSteppedOn);
    const targetScale = this._uniforms.uTrailMinScale
      .mul(isBladeSteppedOn)
      .add(growScale.mul(growScaleFactor));

    gridData2.x = min(targetScale, gridData2.y);

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
    const isBladeAffected = max(isPlayerMoving, gridData2.w).mul(
      baseGlowFactor,
    );

    // Compute fade-in when affected, fade-out when not affected
    const fadeIn = isBladeAffected.mul(this._uniforms.uGlowFadeIn);
    const fadeOut = float(1)
      .sub(isBladeAffected)
      .mul(this._uniforms.uGlowFadeOut);

    // Force fade-out when **fully stationary**
    const forceFadeOut = float(1)
      .sub(isPlayerMoving)
      .mul(this._uniforms.uGlowFadeOut)
      .mul(gridData2.w);

    // Apply glow effect and ensure full fade-out when stationary
    gridData2.w = clamp(
      gridData2.w.add(fadeIn).sub(fadeOut).sub(forceFadeOut),
      0.0,
      1.0,
    );
  })().compute(gridConfig.COUNT);

  private computePosition = Fn(
    ([data1 = vec4(0, 0, 0, 0), data2 = vec3(0, 0, 0)]) => {
      const combinedOffset = data1.xy.sub(this._uniforms.uTileOffset);
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
    // return finalColor.mul(this._uniforms.uTileIdx);
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
    // this.opacityNode = data2.z;
    // this.alphaTest = 0.1;
    this.aoNode = this.computeAO();
    // this.colorNode = this.computeDiffuseColor(data2);
    this.colorNode = this._uniforms.uTileColor;
  }

  async update(state: State) {
    const { renderer, player, clock } = state;
    this._uniforms.uTime.value = clock.getElapsedTime();
    this._uniforms.uPlayerPosition.value.copy(player.position);
    await renderer.computeAsync(this.computeUpdate);
  }
}

const colors = [
  "red",
  "blue",
  "green",
  "purple",
  "black",
  "white",
  "yellow",
  "orange",
  "coral",
];

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
    (tileIdx: number, x: number, z: number): Object3D["onBeforeRender"] =>
    (_, __, ___, ____, material: GrassMaterial) => {
      material.setTileIndex(tileIdx);
      material.setTileOffset(x, z);
      const i = tileIdx % (gridConfig.COUNT - 1);
      material.setTileColor(colors[i]);

      const tile = this.grassField.getObjectByName(`grass-tile-${tileIdx}`) as
        | InstancedMesh
        | undefined;
      if (!tile) return;

      // Read the player's (i.e. the grassField's) position.
      const playerPos = this.grassField.position;

      // Use the full grid width and half-width for the wrapping math.
      const gridWidth = gridConfig.GRID_WIDTH; // e.g. n * m
      const halfGridWidth = gridConfig.GRID_HALF_WIDTH; // i.e. gridWidth/2

      // Compute the tile's offset from the player.
      const dx = x - playerPos.x;
      const dz = z - playerPos.z;

      // Wrap each coordinate into the interval [-halfGridWidth, halfGridWidth]
      // (Note: the extra "+ gridWidth" is to ensure a positive result before the second modulo)
      const wrappedX =
        ((((dx + halfGridWidth) % gridWidth) + gridWidth) % gridWidth) -
        halfGridWidth;
      const wrappedZ =
        ((((dz + halfGridWidth) % gridWidth) + gridWidth) % gridWidth) -
        halfGridWidth;

      tile.position.set(wrappedX, 0, wrappedZ);

      tile.boundingBox?.copy(config.getBoundingBox(wrappedX, wrappedZ));

      tile.boundingSphere?.copy(config.getBoundingSphere(wrappedX, wrappedZ));

      // // Get the bounding sphere mesh for this tile.
      // const bs = this.grassField.getObjectByName(`bs-tile-${tileIdx}`) as
      //   | Mesh
      //   | undefined;
      // if (!bs) return;

      // // Update the bounding sphere center.
      // // bs.position.set(wrappedX, 0, wrappedZ);
      // bs.position.copy(tile.boundingSphere!.center);
    };

  private createGrassGrid() {
    const grid = new Group();
    grid.name = "grass";

    const offsetXZ = gridConfig.GRID_HALF_WIDTH - config.TILE_HALF_SIZE;

    let i = 0;
    for (let row = 0; row < gridConfig.GRID_SIZE; row++) {
      const z = config.TILE_SIZE * row - offsetXZ;
      for (let col = 0; col < gridConfig.GRID_SIZE; col++) {
        const x = config.TILE_SIZE * col - offsetXZ;
        const tile = this.createTile(x, z);
        // tile.frustumCulled = false;
        tile.name = `grass-tile-${i}`;
        tile.onBeforeRender = this.onBeforeRenderTile(i, x, z);
        // const bs = new Mesh(
        //   new SphereGeometry(tile.boundingSphere!.radius),
        //   new MeshBasicMaterial({ color: colors[i], wireframe: true }),
        // );
        // bs.position.copy(tile.boundingSphere!.center);
        // bs.name = `bs-tile-${i}`;
        // grid.add(bs);
        grid.add(tile);
        i++;
      }
    }
    return grid;
  }

  private createTile(x = 0, z = 0) {
    const tile = new InstancedMesh(this.geometry, this.material, config.COUNT);
    tile.position.set(x, 0, z);
    tile.boundingBox = config.boundingBox;
    tile.boundingSphere = config.getBoundingSphere(x, z);
    return tile;
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
