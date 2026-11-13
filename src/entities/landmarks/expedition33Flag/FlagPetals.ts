import { InstancedMesh, PlaneGeometry, Sphere, type Vector3 } from "three";
import { graphics, stage } from "../../../systems";
import type { ComputeTask } from "../../../systems/rendering/ComputeTask";
import { petalConfig, petalUniforms } from "./config";
import type { FlagCompute } from "./FlagCompute";
import { PetalCompute } from "./PetalCompute";
import { PetalMaterial } from "./PetalMaterial";

const PETAL_WIDTH = 0.6;
const PETAL_CUP = 0.12;
// long frame hitches would make petals jump
const MAX_STEP_SECONDS = 1 / 20;

const createTeardropGeometry = () => {
  const geometry = new PlaneGeometry(PETAL_WIDTH, 1, 2, 4);
  const positions = geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index++) {
    const along = positions.getY(index) + 0.5;
    const profile = Math.sin(Math.PI * Math.min(along * 0.85 + 0.08, 1));
    const x = positions.getX(index) * profile ** 0.7;
    const across = x / (PETAL_WIDTH / 2);
    positions.setXYZ(index, x, positions.getY(index), across ** 2 * PETAL_CUP);
  }
  geometry.computeVertexNormals();
  return geometry;
};

export class FlagPetals {
  private compute: PetalCompute;
  private computeTask: ComputeTask;

  constructor(flagCompute: FlagCompute, origin: Vector3) {
    this.compute = new PetalCompute(flagCompute);
    petalUniforms.uFlagOrigin.value.copy(origin);
    this.computeTask = graphics.createComputeTask({
      label: "Expedition33 petals",
      init: this.compute.computeInit,
      update: this.compute.computeUpdate,
    });
    this.computeTask.init();

    const geometry = createTeardropGeometry();
    // petals only exist on the gpu, so the bounds cover everywhere they can fly
    geometry.boundingSphere = new Sphere(origin.clone(), petalConfig.REACH);
    const mesh = new InstancedMesh(
      geometry,
      new PetalMaterial(this.compute),
      petalConfig.COUNT,
    );
    mesh.name = "expedition-33-petals";
    stage.mainScene.add(mesh);
  }

  update(delta: number) {
    petalUniforms.uDelta.value = Math.min(delta, MAX_STEP_SECONDS);
    this.computeTask.update();
  }
}
