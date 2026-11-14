import { InstancedMesh, Vector3 } from "three";
import { graphics, stage } from "../../systems";
import type { ComputeTask } from "../../systems/rendering/ComputeTask";
import { birdConfig, birdUniforms } from "./pampasBirdsConfig";
import { PampasBirdsCompute } from "./PampasBirdsCompute";
import { createPampasBirdsGeometry } from "./pampasBirdsGeometry";
import { PampasBirdsMaterial } from "./PampasBirdsMaterial";

const { COUNT, MAX_STEP_SECONDS } = birdConfig;

export class PampasBirds {
  readonly compute = new PampasBirdsCompute();
  private computeTask: ComputeTask;
  private previousPlayerPosition = new Vector3();
  private hasPreviousPosition = false;

  constructor() {
    this.computeTask = graphics.createComputeTask({
      label: "Pampas birds",
      init: this.compute.computeInit,
      update: this.compute.computeUpdate,
    });
    this.computeTask.init();

    const mesh = new InstancedMesh(
      createPampasBirdsGeometry(),
      new PampasBirdsMaterial(this.compute),
      COUNT,
    );
    mesh.name = "pampas-birds";
    mesh.frustumCulled = false;
    stage.mainScene.add(mesh);
  }

  update(delta: number, playerPosition: Vector3) {
    if (delta <= 0) return;

    if (!this.hasPreviousPosition)
      this.previousPlayerPosition.copy(playerPosition);
    this.hasPreviousPosition = true;

    birdUniforms.uPlayerVelocity.value
      .subVectors(playerPosition, this.previousPlayerPosition)
      .divideScalar(delta);
    this.previousPlayerPosition.copy(playerPosition);
    birdUniforms.uDelta.value = Math.min(delta, MAX_STEP_SECONDS);

    this.computeTask.update();
  }
}
