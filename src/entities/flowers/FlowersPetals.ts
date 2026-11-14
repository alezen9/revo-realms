import { InstancedMesh, Vector3 } from "three";
import { graphics, stage } from "../../systems";
import type { ComputeTask } from "../../systems/rendering/ComputeTask";
import { createExpedition33PetalsGeometry } from "../landmarks/expedition33/expedition33PetalsGeometry";
import { petalConfig, petalUniforms } from "./flowersPetalsConfig";
import { FlowersPetalsCompute } from "./FlowersPetalsCompute";
import { FlowersPetalsMaterial } from "./FlowersPetalsMaterial";

const { COUNT, MAX_STEP_SECONDS, MAX_STEP_DISTANCE } = petalConfig;
const SHED_SEED_STEP = 0x9e3779b1;

export class FlowersPetals {
  readonly compute = new FlowersPetalsCompute();
  private computeTask: ComputeTask;
  private playerStep = new Vector3();
  private previousPlayerPosition = new Vector3();
  private hasPreviousPosition = false;

  constructor() {
    this.computeTask = graphics.createComputeTask({
      label: "Flowers petals",
      init: this.compute.computeInit,
      update: this.compute.computeUpdate,
    });
    this.computeTask.init();

    const mesh = new InstancedMesh(
      createExpedition33PetalsGeometry(),
      new FlowersPetalsMaterial(this.compute),
      COUNT,
    );
    mesh.name = "flowers-petals";
    mesh.frustumCulled = false;
    stage.mainScene.add(mesh);
  }

  update(delta: number, playerPosition: Vector3) {
    if (delta <= 0) return;

    if (!this.hasPreviousPosition)
      this.previousPlayerPosition.copy(playerPosition);
    this.hasPreviousPosition = true;

    this.playerStep.subVectors(playerPosition, this.previousPlayerPosition);
    this.previousPlayerPosition.copy(playerPosition);
    const stepDistance = Math.hypot(this.playerStep.x, this.playerStep.z);
    const isContinuousStep = stepDistance < MAX_STEP_DISTANCE;

    petalUniforms.uPlayerVelocity.value
      .copy(this.playerStep)
      .divideScalar(delta);
    petalUniforms.uPlayerStepDistance.value = isContinuousStep
      ? stepDistance
      : 0;
    petalUniforms.uShedSeed.value =
      (petalUniforms.uShedSeed.value + SHED_SEED_STEP) % 0x100000000;
    petalUniforms.uDelta.value = Math.min(delta, MAX_STEP_SECONDS);

    this.computeTask.update();
  }
}
