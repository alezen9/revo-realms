import { InstancedMesh, type Mesh } from "three";
import { texture } from "three/tsl";
import { assets, eventBus, graphics, stage } from "../../systems";
import type { ComputeTask } from "../../systems/rendering/ComputeTask";
import { createPineTreesColliders } from "./pineTreesCollider";
import { PineTreesCompute } from "./PineTreesCompute";
import { debugPineTrees } from "./pineTreesDebug";
import {
  PineTreesBarkMaterial,
  PineTreesCanopyMaterial,
} from "./PineTreesMaterial";

export class PineTrees {
  private compute: PineTreesCompute;
  private computeTask: ComputeTask;

  constructor() {
    const { pineModel, pinesPlacements } = assets.resources;
    const canopy = assets.getMesh("pine-canopy", pineModel);
    const bark = assets.getMesh("pine-bark", pineModel);
    const collider = assets.getObject("pine-capsule-collider", pineModel);
    const { buffer, byteOffset, byteLength } = pinesPlacements;
    const matrices = new Float32Array(buffer, byteOffset, byteLength / 4);

    this.compute = new PineTreesCompute(matrices, [
      bark.geometry,
      canopy.geometry,
    ]);
    this.computeTask = graphics.createComputeTask({
      label: "Pine trees",
      update: [
        this.compute.computeResetInstanceCounts,
        this.compute.computeCull,
      ],
    });

    canopy.geometry.computeBoundingBox();
    const canopyBounds = canopy.geometry.boundingBox;
    if (!canopyBounds) throw new Error("Pine canopy has no bounding box");
    const crownHeight = canopyBounds.max.y;

    const barkMesh = this.createInstancedMesh(
      bark,
      new PineTreesBarkMaterial(crownHeight),
      0,
    );
    const canopyMesh = this.createInstancedMesh(
      canopy,
      new PineTreesCanopyMaterial(crownHeight),
      1,
    );
    stage.mainScene.add(barkMesh, canopyMesh);
    graphics.vsmPass.registerCaster(barkMesh);
    graphics.vsmPass.registerCaster(canopyMesh, {
      opacityNode: texture(assets.resources.pineCanopyDiffuse).a,
    });

    createPineTreesColliders(collider.matrix, matrices);

    eventBus.on("engine-render-update", this.onEngineUpdate);
    debugPineTrees();
  }

  private onEngineUpdate = () => {
    this.computeTask.update();
  };

  private createInstancedMesh(
    part: Mesh,
    material: PineTreesBarkMaterial | PineTreesCanopyMaterial,
    draw: number,
  ) {
    const { geometry } = part;
    const mesh = new InstancedMesh(geometry, material, 0);
    mesh.instanceMatrix = this.compute.visibleMatrices;
    mesh.count = this.compute.visibleMatrices.count;
    mesh.frustumCulled = false;
    geometry.setIndirect(
      this.compute.drawArgumentsAttribute,
      this.compute.getDrawArgumentsOffset(draw),
    );
    return mesh;
  }
}
