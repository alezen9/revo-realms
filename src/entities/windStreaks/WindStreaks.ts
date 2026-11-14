import { InstancedMesh, PlaneGeometry } from "three/webgpu";
import { type State } from "../../Game";
import type { ComputeTask } from "../../systems/rendering/ComputeTask";
import { eventBus, pipelineWarmup, graphics, stage, wind } from "../../systems";
import { config, uniforms } from "./windStreaksConfig";
import { WindStreaksCompute } from "./WindStreaksCompute";
import { debugWindStreaks } from "./windStreaksDebug";
import { WindStreaksMaterial } from "./WindStreaksMaterial";

const { SEGMENT_COUNT, STREAK_COUNT, MAX_UPDATE_DELTA } = config;

export class WindStreaks {
  private streaksCompute = new WindStreaksCompute();
  private computeTask: ComputeTask;
  private mesh: InstancedMesh;
  private elapsedSinceUpdate = 0;
  private isResetPending = false;
  constructor() {
    this.computeTask = graphics.createComputeTask({
      label: "WindStreaks",
      init: this.streaksCompute.computeStreaks,
      update: this.streaksCompute.computeStreaks,
    });
    this.mesh = this.createMesh();
    stage.mainScene.add(this.mesh);
    void this.computeTask.init().then(this.clearReset, this.clearReset);
    this.registerPrewarmTask();
    eventBus.on("game-wind-start", this.onWindStart);
    eventBus.on("engine-render-update", this.onEngineUpdate);
    debugWindStreaks();
  }

  private createMesh() {
    const mesh = new InstancedMesh(
      new PlaneGeometry(1, 1, 1, SEGMENT_COUNT),
      new WindStreaksMaterial(this.streaksCompute),
      STREAK_COUNT,
    );
    mesh.visible = false;
    mesh.frustumCulled = false;
    return mesh;
  }

  private registerPrewarmTask() {
    pipelineWarmup.registerTask({
      prepare: async () => {
        this.mesh.visible = true;
        await this.computeTask.init();
        await this.computeTask.update();
      },
      restore: () => {
        this.mesh.visible = false;
      },
    });
  }

  private onWindStart = () => {
    this.isResetPending = true;
  };

  private onEngineUpdate = ({ player, delta }: State) => {
    uniforms.uPlayerPosition.value.copy(player.position);

    const isWindActive = wind.uIntensityDirectional.value > 0;
    this.mesh.visible = isWindActive;
    if (!isWindActive && !this.isResetPending) {
      this.elapsedSinceUpdate = 0;
      return;
    }

    this.elapsedSinceUpdate = Math.min(
      this.elapsedSinceUpdate + delta,
      MAX_UPDATE_DELTA,
    );
    this.updateStreaks();
  };

  private updateStreaks() {
    if (!this.computeTask.canUpdate) return;

    uniforms.uDelta.value = this.elapsedSinceUpdate;
    uniforms.uReset.value = Number(this.isResetPending);

    const didUpdate = this.computeTask.update();
    if (!didUpdate) return;

    this.elapsedSinceUpdate = 0;
    this.isResetPending = false;
    this.clearReset();
  }

  private clearReset = () => {
    uniforms.uReset.value = 0;
  };
}
