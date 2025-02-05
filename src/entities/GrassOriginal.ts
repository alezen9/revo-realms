import {
  BufferAttribute,
  BufferGeometry,
  MathUtils,
  InstancedMesh,
  Object3D,
  Scene,
} from "three";
import { State } from "../Game";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { uniform } from "three/tsl";
import GrassMaterial from "../materials/GrassMaterial";

type BladeGeometryData = {
  positions: Float32Array;
  uvs: Float32Array;
  indices?: Uint8Array;
};

type GrassChunk = {
  center: { x: number; z: number };
  highMesh: InstancedMesh;
  lowMesh: InstancedMesh;
  boundingRadius: number;
};

export default class Grass {
  private readonly AREA_SIDE_SIZE = 8; // better if pow of 2 or even
  private readonly TILES_PER_CHUNK_SIDE = this.AREA_SIDE_SIZE * 2;
  private readonly NUM_BLADES_PER_SIDE_HIGH = this.AREA_SIDE_SIZE * 10;
  private readonly NUM_BLADES_PER_SIDE_LOW_LOD = this.AREA_SIDE_SIZE * 10; // better if pow of 2 or perfect square
  private readonly BLADE_WIDTH = 0.025;
  private readonly BLADE_HEIGHT = 0.75;

  private readonly LOD_DIST_HIGH = 50;
  private readonly NUM_TILES_PER_CHUNK_SIDE = 2;

  private uTime = uniform(0);

  private chunks: GrassChunk[] = [];

  private dummy = new Object3D();

  constructor(scene: State["scene"]) {
    this.buildGrassChunks(scene);
  }

  private buildGrassChunks(scene: Scene) {
    const material = new GrassMaterial({ uTime: this.uTime });
    const highGeometryData = this.createGrassBladeGeometryDataHighLOD();
    const lowGeometryData = this.createGrassBladeGeometryDataLowLOD();
    const highLODGeometry = this.createGeometry("high", highGeometryData);
    const lowLODGeometry = this.createGeometry("low", lowGeometryData);

    const instancesPerSide = 5;
    const totalAreaSide = this.AREA_SIDE_SIZE * instancesPerSide;
    const halfInstancesAreaSize = totalAreaSide / 2 + this.AREA_SIDE_SIZE;

    for (let chunkIdxX = 0; chunkIdxX < instancesPerSide; chunkIdxX++) {
      for (let chunkIdxZ = 0; chunkIdxZ < instancesPerSide; chunkIdxZ++) {
        const chunk = this.buildSingleChunk(
          chunkIdxX,
          chunkIdxZ,
          highLODGeometry,
          lowLODGeometry,
          material,
          scene,
          halfInstancesAreaSize,
        );
        this.chunks.push(chunk);
      }
    }
  }

  private buildSingleChunk(
    chunkIndexX: number,
    chunkIndexZ: number,
    geometryHigh: BufferGeometry,
    geometryLow: BufferGeometry,
    material: MeshBasicNodeMaterial,
    scene: Scene,
    offset: number,
  ): GrassChunk {
    const meshHigh = new InstancedMesh(
      geometryHigh,
      material,
      this.TILES_PER_CHUNK_SIDE,
    );
    const meshLow = new InstancedMesh(
      geometryLow,
      material,
      this.TILES_PER_CHUNK_SIDE,
    );

    meshHigh.visible = false;

    const chunkWorldX =
      chunkIndexX * this.NUM_TILES_PER_CHUNK_SIDE * this.AREA_SIDE_SIZE -
      offset;
    const chunkWorldZ =
      chunkIndexZ * this.NUM_TILES_PER_CHUNK_SIDE * this.AREA_SIDE_SIZE -
      offset;

    // Fill tile transforms using a dummy Object3D so threejs does the math
    let tileFlatIdx = 0;
    for (
      let tileIdxX = 0;
      tileIdxX < this.NUM_TILES_PER_CHUNK_SIDE;
      tileIdxX++
    ) {
      for (
        let tileIdxZ = 0;
        tileIdxZ < this.NUM_TILES_PER_CHUNK_SIDE;
        tileIdxZ++
      ) {
        const tileX =
          chunkWorldX +
          tileIdxX * this.AREA_SIDE_SIZE +
          this.AREA_SIDE_SIZE / 2;
        const tileZ =
          chunkWorldZ +
          tileIdxZ * this.AREA_SIDE_SIZE +
          this.AREA_SIDE_SIZE / 2;

        this.dummy.position.set(tileX, 0, tileZ);
        this.dummy.updateMatrix();

        meshHigh.setMatrixAt(tileFlatIdx, this.dummy.matrix);
        meshLow.setMatrixAt(tileFlatIdx, this.dummy.matrix);
        tileFlatIdx++;
      }
    }

    meshHigh.instanceMatrix.needsUpdate = true;
    meshLow.instanceMatrix.needsUpdate = true;

    scene.add(meshHigh, meshLow);

    // Compute chunk center
    const chunkCenterX =
      chunkWorldX + (this.NUM_TILES_PER_CHUNK_SIDE * this.AREA_SIDE_SIZE) / 2;
    const chunkCenterZ =
      chunkWorldZ + (this.NUM_TILES_PER_CHUNK_SIDE * this.AREA_SIDE_SIZE) / 2;

    // Approximate bounding radius
    const chunkDiagonal = this.NUM_TILES_PER_CHUNK_SIDE * this.AREA_SIDE_SIZE;
    const boundingRadius = (Math.sqrt(2) * chunkDiagonal) / 2;

    return {
      center: { x: chunkCenterX, z: chunkCenterZ },
      highMesh: meshHigh,
      lowMesh: meshLow,
      boundingRadius,
    };
  }

  private vertexScaleY(vertex: number[], scale = 1) {
    const [x, y, z] = vertex;
    return [x, y * scale, z];
  }

  private vertexBendX(vertex: number[], maxAngle = 0) {
    const [x, y, z] = vertex;

    // Calculate how much to rotate based on the height (y-axis)
    const t = y / this.BLADE_HEIGHT;
    const angle = maxAngle * t; // Gradual rotation from 0 to maxAngle

    const cosTheta = Math.cos(angle);
    const sinTheta = Math.sin(angle);

    // Rotate around X-axis
    const rotatedY = y * cosTheta - z * sinTheta;
    const rotatedZ = y * sinTheta + z * cosTheta;

    return [x, rotatedY, rotatedZ];
  }

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

  private createGrassBladeGeometryDataLowLOD(): BladeGeometryData {
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
    };
  }

  private createGrassBladeGeometryDataHighLOD(): BladeGeometryData {
    /**
     *        I
     *      /   \
     *    G ------ H
     *    |   /    |
     *    E ------ F
     *    |   /    |
     *    C ------ D
     *    |   /    |
     *    A ------ B
     *
     *  - Bottom Quad: A-B-D-C (2 triangles)
     *  - Middle Quad: C-D-F-E (2 triangles)
     *  - Top Quad:    E-F-H-G (2 triangles)
     *  - Tip:         G-H-I   (1 triangle)
     *
     *  Total: 7 triangles for smooth high-definition bending.
     */

    const halfWidth = this.BLADE_WIDTH / 2;
    const height = this.BLADE_HEIGHT;

    const segmentHeight = height / 4;

    const positions = new Float32Array([
      -halfWidth,
      0,
      0, // A
      halfWidth,
      0,
      0, // B
      -halfWidth,
      segmentHeight,
      0, // C
      halfWidth,
      segmentHeight,
      0, // D
      -halfWidth,
      segmentHeight * 2,
      0, // E
      halfWidth,
      segmentHeight * 2,
      0, // F
      -halfWidth,
      segmentHeight * 3,
      0, // G
      halfWidth,
      segmentHeight * 3,
      0, // H
      0,
      height,
      0, // I - Tip (8)
    ]);

    const indices = new Uint8Array([
      // Bottom Quad (A-B-D, A-D-C)
      0, 1, 3, 0, 3, 2,
      // Middle Quad (C-D-F, C-F-E)
      2, 3, 5, 2, 5, 4,
      // Top Quad (E-F-H, E-H-G)
      4, 5, 7, 4, 7, 6,
      // Tip (G-H-I)
      6, 7, 8,
    ]);

    const uvs = new Float32Array([
      0,
      0,
      1,
      0,
      0,
      0.25,
      1,
      0.25, // Bottom Quad
      0,
      0.5,
      1,
      0.5, // Middle Quad
      0,
      0.75,
      1,
      0.75, // Top Quad
      0.5,
      1, // Tip
    ]);

    return {
      positions,
      indices,
      uvs,
    };
  }

  private createGeometry(lod: "high" | "low", data: BladeGeometryData) {
    const {
      positions: bladePositions,
      indices: bladeIndices,
      uvs: bladeUVs,
    } = data;

    const bladeVertexCount = bladePositions.length / 3;
    const bladeIndexCount = bladeIndices?.length || 0;
    const bladesPerSide =
      lod == "high"
        ? this.NUM_BLADES_PER_SIDE_HIGH
        : this.NUM_BLADES_PER_SIDE_LOW_LOD;
    const totalBlades = Math.pow(bladesPerSide, 2);

    const tileSize = this.AREA_SIDE_SIZE;
    const halfTileSize = tileSize / 2;
    const spacing = tileSize / bladesPerSide;

    // Buffers for the entire tile
    const positions = new Float32Array(bladeVertexCount * totalBlades * 3);
    const uvs = new Float32Array(bladeVertexCount * totalBlades * 2);
    let indices = null;
    if (lod === "high") {
      indices =
        bladeVertexCount * totalBlades < 65_536 // 2^16
          ? new Uint16Array(bladeIndexCount * totalBlades)
          : new Uint32Array(bladeIndexCount * totalBlades);
    }

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
        const bendAngle = MathUtils.randFloat(-0.5, 0.5);
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
          const bentVertex = this.vertexBendX(scaledVertex, bendAngle);
          const rotatedVertex = this.vertexRotateY(bentVertex, rotationAngle);
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
        if (indices && bladeIndices) {
          const vertexIndexOffset = vertexOffset - bladeVertexCount;
          for (let i = 0; i < bladeIndexCount; i++) {
            indices[indexOffset + i] = bladeIndices[i] + vertexIndexOffset;
          }
          indexOffset += bladeIndexCount;
        }
      }
    }

    const tileGeometry = new BufferGeometry();
    tileGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    tileGeometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    if (indices) tileGeometry.setIndex(new BufferAttribute(indices, 1));

    tileGeometry.computeVertexNormals();

    return tileGeometry;
  }

  // ########################################
  //            Per-Frame logic
  // ########################################

  public update(state: State) {
    const { clock, camera } = state;
    // this.updateChunkLOD(camera);
    this.uTime.value = clock.getElapsedTime();
  }

  private updateChunkLOD(camera: State["camera"]) {
    const cameraPos = camera.position;
    const lodThresholdSq = this.LOD_DIST_HIGH * this.LOD_DIST_HIGH;

    for (const chunk of this.chunks) {
      // 3D distance from chunk center
      const dx = cameraPos.x - chunk.center.x;
      const dy = cameraPos.y; // floor is y=0
      const dz = cameraPos.z - chunk.center.z;
      const distanceSq = dx * dx + dy * dy + dz * dz;

      // Hard cutoff-based LOD logic
      if (distanceSq < lodThresholdSq) {
        chunk.highMesh.visible = true;
        chunk.lowMesh.visible = false;
      } else {
        chunk.highMesh.visible = false;
        chunk.lowMesh.visible = true;
      }
    }
  }
}
