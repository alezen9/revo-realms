import {
  BufferAttribute,
  BufferGeometry,
  MathUtils,
  InstancedMesh,
  Object3D,
  Vector3,
} from "three";
import { State } from "../Game";
import { uniform } from "three/tsl";
import GrassMaterial from "../materials/GrassMaterial";

type BladeGeometryData = {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint8Array;
};

export default class Grass {
  private readonly TILES_PER_SIDE_COUNT = 4;
  private readonly TILE_SIZE = 4;
  private readonly BLADE_WIDTH = 0.15;
  private readonly BLADE_HEIGHT = 0.75;

  private uTime = uniform(0);

  private dummyObj = new Object3D();
  private instances: InstancedMesh<BufferGeometry, GrassMaterial>;

  constructor(scene: State["scene"]) {
    this.instances = this.createGrassInstances();
    scene.add(this.instances);
  }

  private createGrassInstances() {
    const material = new GrassMaterial({ uTime: this.uTime });
    const geometry = this.createGeometry();

    const instances = new InstancedMesh(
      geometry,
      material,
      this.TILES_PER_SIDE_COUNT * this.TILES_PER_SIDE_COUNT,
    );

    const grassAreaSideSize = this.TILE_SIZE * this.TILES_PER_SIDE_COUNT;
    const areaOffsetXZ = grassAreaSideSize / 2;

    let instanceIdx = 0;
    for (let tileIdxX = 0; tileIdxX < this.TILES_PER_SIDE_COUNT; tileIdxX++) {
      const offsetX =
        this.TILE_SIZE * (tileIdxX + 1) - areaOffsetXZ - this.TILE_SIZE / 2;
      for (let tileIdxZ = 0; tileIdxZ < this.TILES_PER_SIDE_COUNT; tileIdxZ++) {
        const offsetZ =
          this.TILE_SIZE * (tileIdxZ + 1) - areaOffsetXZ - this.TILE_SIZE / 2;
        this.dummyObj.position.set(offsetX, 0, offsetZ);
        this.dummyObj.updateMatrix();
        instances.setMatrixAt(instanceIdx, this.dummyObj.matrix);
        instances.setMatrixAt(instanceIdx, this.dummyObj.matrix);
        instanceIdx++;
      }
    }

    instances.instanceMatrix.needsUpdate = true;

    return instances;
  }

  private vertexScaleY(vertex: number[], scale = 1) {
    const [x, y, z] = vertex;
    return [x, y * scale, z];
  }

  // private vertexBendX(vertex: number[], maxAngle = 0) {
  //   const [x, y, z] = vertex;

  //   // Calculate how much to rotate based on the height (y-axis)
  //   const t = y / this.BLADE_HEIGHT;
  //   const angle = maxAngle * t; // Gradual rotation from 0 to maxAngle

  //   const cosTheta = Math.cos(angle);
  //   const sinTheta = Math.sin(angle);

  //   // Rotate around X-axis
  //   const rotatedY = y * cosTheta - z * sinTheta;
  //   const rotatedZ = y * sinTheta + z * cosTheta;

  //   return [x, rotatedY, rotatedZ];
  // }

  private vertexRotateY(vertex: number[], angle: number) {
    const [x, y, z] = vertex;
    const cosTheta = Math.cos(angle);
    const sinTheta = Math.sin(angle);

    const rotatedX = x * cosTheta + z * sinTheta;
    const rotatedY = y;
    const rotatedZ = -x * sinTheta + z * cosTheta;

    return [rotatedX, rotatedY, rotatedZ];
  }

  private vertexTranslateXZ(vertex: number[], offsetX = 0, offsetZ = 0) {
    const [x, y, z] = vertex;
    const displacedX = x + offsetX;
    const displacedY = y;
    const displacedZ = z + offsetZ;
    return [displacedX, displacedY, displacedZ];
  }

  private createGrassBladeGeometryData(): BladeGeometryData {
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

    const uvs = new Float32Array([0, 0, 1, 0, 0.5, 1]);

    return {
      positions,
      uvs,
      indices: new Uint8Array(),
    };
  }

  private createGeometry() {
    const {
      positions: bladePositions,
      indices: bladeIndices,
      uvs: bladeUVs,
    } = this.createGrassBladeGeometryData();

    const bladeVertexCount = bladePositions.length / 3;
    const bladeIndexCount = bladeIndices?.length || 0;
    const bladesPerSide = this.TILE_SIZE * 10;
    const totalBlades = bladesPerSide * bladesPerSide;

    const tileSize = this.TILE_SIZE;
    const halfTileSize = tileSize / 2;
    const spacing = tileSize / bladesPerSide;

    // Buffers for the entire tile
    const positions = new Float32Array(bladeVertexCount * totalBlades * 3);
    const uvs = new Float32Array(bladeVertexCount * totalBlades * 2);
    const indices =
      bladeVertexCount * totalBlades < 65_536 // 2^16
        ? new Uint16Array(bladeIndexCount * totalBlades)
        : new Uint32Array(bladeIndexCount * totalBlades);

    let vertexOffset = 0; // position data index
    let uvOffset = 0; // UV data index
    let indexOffset = 0; // index data index

    for (let rowIdx = 0; rowIdx < bladesPerSide; rowIdx++) {
      const offsetZ =
        -halfTileSize + rowIdx * spacing + Math.random() * spacing * 0.5;
      for (let colIdx = 0; colIdx < bladesPerSide; colIdx++) {
        const offsetX =
          -halfTileSize + colIdx * spacing + Math.random() * spacing * 0.5;

        // Random rotation for variation
        const rotationAngle = MathUtils.randFloat(-1, 1);
        // const bendAngle = MathUtils.randFloat(-0.5, 0.5);
        const heightScale = MathUtils.randFloat(0.5, 1.25);
        const additionalOffsetZ = MathUtils.randFloat(
          -spacing / 3,
          spacing / 3,
        );
        const additionalOffsetX = MathUtils.randFloat(
          -spacing / 3,
          spacing / 3,
        );

        for (let i = 0; i < bladeVertexCount; i++) {
          const i3 = i * 3;
          const x = bladePositions[i3];
          const y = bladePositions[i3 + 1];
          const z = bladePositions[i3 + 2];
          const vertex = [x, y, z];
          const scaledVertex = this.vertexScaleY(vertex, heightScale);
          // const bentVertex = this.vertexBendX(scaledVertex, bendAngle);
          const rotatedVertex = this.vertexRotateY(scaledVertex, rotationAngle);
          const translatedVertex = this.vertexTranslateXZ(
            rotatedVertex,
            offsetX + additionalOffsetX,
            offsetZ + additionalOffsetZ,
          );

          const v3 = vertexOffset * 3;
          positions[v3] = translatedVertex[0];
          positions[v3 + 1] = translatedVertex[1];
          positions[v3 + 2] = translatedVertex[2];

          vertexOffset++;
        }

        // UVs
        uvs.set(bladeUVs, uvOffset);
        uvOffset += bladeVertexCount * 2;

        // Index
        const vertexIndexOffset = vertexOffset - bladeVertexCount;
        for (let i = 0; i < bladeIndexCount; i++) {
          indices[indexOffset + i] = bladeIndices[i] + vertexIndexOffset;
        }
        indexOffset += bladeIndexCount;
      }
    }

    const tileGeometry = new BufferGeometry();
    tileGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    tileGeometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    if (bladeIndices.length)
      tileGeometry.setIndex(new BufferAttribute(indices, 1));

    tileGeometry.computeVertexNormals();

    return tileGeometry;
  }

  public update(state: State) {
    const { clock, player } = state;
    this.uTime.value = clock.getElapsedTime();
    this.updateGrassPosition(player.getPosition());
  }

  // Instead of a fixed TILES_PER_SIDE_COUNT, move tiles dynamically
  private updateGrassPosition(playerPosition: Vector3) {
    const tileSize = this.TILE_SIZE;
    const halfWorldSize = 256 / 2;

    // Center grass around player
    const centerX = Math.round(playerPosition.x / tileSize) * tileSize;
    const centerZ = Math.round(playerPosition.z / tileSize) * tileSize;

    let instanceIdx = 0;
    for (let tileX = -1; tileX <= 1; tileX++) {
      for (let tileZ = -1; tileZ <= 1; tileZ++) {
        const offsetX = centerX + tileX * tileSize;
        const offsetZ = centerZ + tileZ * tileSize;

        if (
          offsetX < -halfWorldSize ||
          offsetX > halfWorldSize ||
          offsetZ < -halfWorldSize ||
          offsetZ > halfWorldSize
        ) {
          continue; // Skip out-of-bounds tiles
        }

        this.dummyObj.position.set(offsetX, 0, offsetZ);
        this.dummyObj.updateMatrix();
        this.instances.setMatrixAt(instanceIdx, this.dummyObj.matrix);
        instanceIdx++;
      }
    }

    this.instances.instanceMatrix.needsUpdate = true;
  }
}
