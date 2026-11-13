import { InstancedMesh, Sphere, type Vector3 } from "three";
import { graphics, stage } from "../../../systems";
import type { ComputeTask } from "../../../systems/rendering/ComputeTask";
import type { Expedition33FlagCompute } from "./Expedition33FlagCompute";
import { petalConfig, petalUniforms } from "./Expedition33PetalsConfig";
import { Expedition33PetalsCompute } from "./Expedition33PetalsCompute";
import { debugExpedition33Petals } from "./Expedition33PetalsDebug";
import { createExpedition33PetalsGeometry } from "./Expedition33PetalsGeometry";
import { Expedition33PetalsMaterial } from "./Expedition33PetalsMaterial";

export class Expedition33Petals {
  private compute: Expedition33PetalsCompute;
  private computeTask: ComputeTask;

  constructor(flagCompute: Expedition33FlagCompute, origin: Vector3) {
    this.compute = new Expedition33PetalsCompute(flagCompute);
    petalUniforms.uFlagOrigin.value.copy(origin);
    this.computeTask = graphics.createComputeTask({
      label: "Expedition33 petals",
      init: this.compute.computeInit,
      update: this.compute.computeUpdate,
    });
    this.computeTask.init();
    debugExpedition33Petals();

    const geometry = createExpedition33PetalsGeometry();
    // petals only exist on the gpu, so the bounds cover everywhere they can fly
    geometry.boundingSphere = new Sphere(origin.clone(), petalConfig.REACH);
    const mesh = new InstancedMesh(
      geometry,
      new Expedition33PetalsMaterial(this.compute),
      petalConfig.COUNT,
    );
    mesh.name = "expedition-33-petals";
    stage.mainScene.add(mesh);
  }

  update(delta: number) {
    petalUniforms.uDelta.value = Math.min(delta, petalConfig.MAX_STEP_SECONDS);
    this.computeTask.update();
  }
}
