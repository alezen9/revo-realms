import { InstancedMesh, Matrix4, Mesh } from "three";
import { assets, graphics, stage } from "../../systems";
import { createLakeRocksCollider } from "./lakeRocksCollider";
import { config } from "./lakeRocksConfig";
import { debugLakeRocks } from "./lakeRocksDebug";
import { LakeRocksMaterial } from "./LakeRocksMaterial";

const { ROCKS } = config;

export class LakeRocks {
  private meshes: Mesh[] = [];
  private shadowSettings = { depthBias: 0 };

  constructor() {
    const { lakeRocksModel, lakeRocksPlacements } = assets.resources;
    const { buffer, byteOffset, byteLength } = lakeRocksPlacements;
    const matrices = new Float32Array(buffer, byteOffset, byteLength / 4);
    const rockCount = matrices.length / 16;

    const material = new LakeRocksMaterial();
    const matrix = new Matrix4();

    const { geometry: surfacingGeometry } = assets.getMesh(
      "lake-rock-surfacing",
      lakeRocksModel,
    );
    const surfacingRock = new Mesh(surfacingGeometry, material);
    surfacingRock.name = "lake-rock-surfacing";
    matrix
      .fromArray(matrices, 0)
      .decompose(
        surfacingRock.position,
        surfacingRock.quaternion,
        surfacingRock.scale,
      );
    surfacingRock.updateMatrixWorld();
    this.meshes.push(surfacingRock);

    const capacity = Math.ceil(rockCount / ROCKS.length);
    const sunkRocks: InstancedMesh[] = [];
    for (const name of ROCKS) {
      const { geometry } = assets.getMesh(name, lakeRocksModel);
      const mesh = new InstancedMesh(geometry, material, capacity);
      mesh.name = name;
      mesh.count = 0;
      sunkRocks.push(mesh);
    }

    for (let placementIndex = 1; placementIndex < rockCount; placementIndex++) {
      const mesh = sunkRocks[placementIndex % ROCKS.length];
      matrix.fromArray(matrices, placementIndex * 16);
      mesh.setMatrixAt(mesh.count, matrix);
      mesh.count++;
    }

    for (const mesh of sunkRocks) {
      const hasRocks = mesh.count > 0;
      if (!hasRocks) continue;
      this.meshes.push(mesh);
    }
    for (const mesh of this.meshes) {
      stage.mainScene.add(mesh);
      graphics.vsmPass.registerCaster(mesh, this.shadowSettings);
    }

    createLakeRocksCollider(surfacingRock);
    debugLakeRocks(this.meshes, this.shadowSettings);
  }
}
