import { InstancedMesh, Matrix4 } from "three";
import { texture } from "three/tsl";
import { assets, graphics, stage } from "../../systems";
import { debugLakePlants } from "./lakePlantsDebug";
import { LakePlantsMaterial } from "./LakePlantsMaterial";

export class LakePlants {
  constructor() {
    const {
      reedsModel,
      reedsPlacements,
      reedsDiffuse,
      seaweedModel,
      seaweedPlacements,
      seaweedDiffuse,
    } = assets.resources;

    const kinds = [
      {
        name: "reeds",
        model: reedsModel,
        placements: reedsPlacements,
        diffuse: reedsDiffuse,
        tintVariety: 0,
      },
      {
        name: "seaweed",
        model: seaweedModel,
        placements: seaweedPlacements,
        diffuse: seaweedDiffuse,
        tintVariety: 1,
      },
    ];

    const matrix = new Matrix4();
    for (const { name, model, placements, diffuse, tintVariety } of kinds) {
      const { geometry } = assets.getMesh(name, model);
      const { buffer, byteOffset, byteLength } = placements;
      const matrices = new Float32Array(buffer, byteOffset, byteLength / 4);

      const mesh = new InstancedMesh(
        geometry,
        new LakePlantsMaterial(diffuse, tintVariety),
        matrices.length / 16,
      );
      for (let index = 0; index < mesh.count; index++)
        mesh.setMatrixAt(index, matrix.fromArray(matrices, index * 16));
      mesh.name = name;
      stage.mainScene.add(mesh);
      graphics.vsmPass.registerCaster(mesh, {
        opacityNode: texture(diffuse).a,
      });
    }

    debugLakePlants();
  }
}
