import {
  Scene,
  InstancedMesh,
  PlaneGeometry,
  Object3D,
  MeshStandardMaterial,
} from "three";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { State } from "../core/Engine";

interface FloorChunk {
  center: { x: number; z: number };
  highMesh: InstancedMesh;
  medMesh: InstancedMesh;
  lowMesh: InstancedMesh;
  boundingRadius: number;
}

export default class Floor {
  // Sizing
  private readonly TILE_SIZE = 4;
  private readonly NUM_TILES_PER_FLOOR_SIDE = 250;
  private readonly NUM_TILES_PER_CHUNK_SIDE = 50; // # of tiles per side
  private readonly FLOOR_COLLIDER_HALF_HEIGHT = 0.3;

  // LOD
  private readonly SUBDIVISION_HIGH = 16;
  private readonly SUBDIVISION_MED = 4;
  private readonly SUBDIVISION_LOW = 1;
  private readonly LOD_DIST_HIGH = 200;
  private readonly LOD_DIST_MED = 350;

  // Materials for each LOD (only for debug)
  private readonly materialHigh = new MeshStandardMaterial({ color: "red" });
  private readonly materialMed = new MeshStandardMaterial({ color: "green" });
  private readonly materialLow = new MeshStandardMaterial({ color: "blue" });

  // Floor State
  private chunks: FloorChunk[] = [];

  constructor(state: State) {
    const { scene, world } = state;

    // 1) Create all floor chunks (instanced meshes)
    this.buildFloorChunks(scene);

    // 2) Create one big physics collider for the entire floor
    const rigidBody = world.createRigidBody(this.createFloorRigidBodyDesc());
    world.createCollider(this.createFloorColliderDesc(), rigidBody);
  }

  /**
   * Build all floor chunks by subdividing the total area into chunk blocks.
   * Each chunk contains NUM_TILES_PER_CHUNK_SIDE × NUM_TILES_PER_CHUNK_SIDE tiles.
   */
  private buildFloorChunks(scene: Scene) {
    const geometryHigh = this.buildTileGeometry(this.SUBDIVISION_HIGH);
    const geometryMed = this.buildTileGeometry(this.SUBDIVISION_MED);
    const geometryLow = this.buildTileGeometry(this.SUBDIVISION_LOW);

    const numChunksPerSide =
      this.NUM_TILES_PER_FLOOR_SIDE / this.NUM_TILES_PER_CHUNK_SIDE;

    const totalFloorSideLength = this.NUM_TILES_PER_FLOOR_SIDE * this.TILE_SIZE;
    const offset = totalFloorSideLength / 2; // Offset by half to center the floor at (0, 0, 0)

    for (let chunkIdxX = 0; chunkIdxX < numChunksPerSide; chunkIdxX++) {
      for (let chunkIdxZ = 0; chunkIdxZ < numChunksPerSide; chunkIdxZ++) {
        const chunk = this.buildSingleChunk(
          chunkIdxX,
          chunkIdxZ,
          geometryHigh,
          geometryMed,
          geometryLow,
          scene,
          offset,
        );
        this.chunks.push(chunk);
      }
    }
  }

  /**
   * Build a single chunk, returning a FloorChunk object with references to each LOD mesh.
   */
  private buildSingleChunk(
    chunkIndexX: number,
    chunkIndexZ: number,
    geometryHigh: PlaneGeometry,
    geometryMed: PlaneGeometry,
    geometryLow: PlaneGeometry,
    scene: Scene,
    offset: number,
  ): FloorChunk {
    const tileCount =
      this.NUM_TILES_PER_CHUNK_SIDE * this.NUM_TILES_PER_CHUNK_SIDE;

    const meshHigh = new InstancedMesh(
      geometryHigh,
      this.materialHigh,
      tileCount,
    );
    const meshMed = new InstancedMesh(geometryMed, this.materialMed, tileCount);
    const meshLow = new InstancedMesh(geometryLow, this.materialLow, tileCount);

    // Hide medium & low initially
    meshMed.visible = false;
    meshLow.visible = false;

    // Calculate chunk's "bottom-left" corner in world coords
    const chunkWorldX =
      chunkIndexX * this.NUM_TILES_PER_CHUNK_SIDE * this.TILE_SIZE - offset;
    const chunkWorldZ =
      chunkIndexZ * this.NUM_TILES_PER_CHUNK_SIDE * this.TILE_SIZE - offset;

    // Fill tile transforms using a dummy Object3D so threejs does the math
    const dummy = new Object3D();
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
          chunkWorldX + tileIdxX * this.TILE_SIZE + this.TILE_SIZE / 2;
        const tileZ =
          chunkWorldZ + tileIdxZ * this.TILE_SIZE + this.TILE_SIZE / 2;

        dummy.position.set(tileX, 0, tileZ);
        dummy.rotation.x = -Math.PI / 2; // plane facing up
        dummy.updateMatrix();

        meshHigh.setMatrixAt(tileFlatIdx, dummy.matrix);
        meshMed.setMatrixAt(tileFlatIdx, dummy.matrix);
        meshLow.setMatrixAt(tileFlatIdx, dummy.matrix);
        tileFlatIdx++;
      }
    }

    meshHigh.instanceMatrix.needsUpdate = true;
    meshMed.instanceMatrix.needsUpdate = true;
    meshLow.instanceMatrix.needsUpdate = true;

    scene.add(meshHigh, meshMed, meshLow);

    // Compute chunk center
    const chunkCenterX =
      chunkWorldX + (this.NUM_TILES_PER_CHUNK_SIDE * this.TILE_SIZE) / 2;
    const chunkCenterZ =
      chunkWorldZ + (this.NUM_TILES_PER_CHUNK_SIDE * this.TILE_SIZE) / 2;

    // Approximate bounding radius
    const chunkDiagonal = this.NUM_TILES_PER_CHUNK_SIDE * this.TILE_SIZE;
    const boundingRadius = (Math.sqrt(2) * chunkDiagonal) / 2;

    return {
      center: { x: chunkCenterX, z: chunkCenterZ },
      highMesh: meshHigh,
      medMesh: meshMed,
      lowMesh: meshLow,
      boundingRadius,
    };
  }

  public update(state: State) {
    this.updateChunkLOD(state);
  }

  /**
   * For each chunk, compute camera distance and switch LOD visibility accordingly.
   */
  private updateChunkLOD(state: State) {
    const { camera } = state;
    const cameraPos = camera.position;

    for (const chunk of this.chunks) {
      // 3D distance from chunk center
      const dx = cameraPos.x - chunk.center.x;
      const dy = cameraPos.y; // floor is y=0
      const dz = cameraPos.z - chunk.center.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Hard cutoff-based LOD logic
      if (distance < this.LOD_DIST_HIGH) {
        chunk.highMesh.visible = true;
        chunk.medMesh.visible = false;
        chunk.lowMesh.visible = false;
      } else if (distance < this.LOD_DIST_MED) {
        chunk.highMesh.visible = false;
        chunk.medMesh.visible = true;
        chunk.lowMesh.visible = false;
      } else {
        chunk.highMesh.visible = false;
        chunk.medMesh.visible = false;
        chunk.lowMesh.visible = true;
      }
    }
  }

  private buildTileGeometry(subdivisions: number) {
    return new PlaneGeometry(
      this.TILE_SIZE,
      this.TILE_SIZE,
      subdivisions,
      subdivisions,
    );
  }

  private createFloorRigidBodyDesc() {
    return RigidBodyDesc.fixed().setTranslation(
      0,
      -this.FLOOR_COLLIDER_HALF_HEIGHT,
      0,
    );
  }

  private createFloorColliderDesc() {
    const halfExtent = (this.NUM_TILES_PER_FLOOR_SIDE * this.TILE_SIZE) / 2;
    return ColliderDesc.cuboid(
      halfExtent,
      this.FLOOR_COLLIDER_HALF_HEIGHT,
      halfExtent,
    )
      .setFriction(1)
      .setRestitution(0.2);
  }
}
