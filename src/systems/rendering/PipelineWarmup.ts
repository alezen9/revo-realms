import { Object3D } from "three";
import type { Graphics } from "./Graphics";
import type { Stage } from "../scene/Stage";

type StartupPrewarmResult = {
  completed: boolean;
  error?: unknown;
};

type FrustumCullState = {
  object: Object3D;
  frustumCulled: boolean;
};

type PrewarmTask = {
  prepare: () => void | Promise<void>;
  restore: () => void;
};

export class PipelineWarmup {
  private graphics: Graphics;
  private stage: Stage;
  private tasks: PrewarmTask[] = [];
  private frustumCullStates: FrustumCullState[] = [];

  constructor(graphics: Graphics, stage: Stage) {
    this.graphics = graphics;
    this.stage = stage;
  }

  registerTask(task: PrewarmTask) {
    this.tasks.push(task);
  }

  async runStartupPrewarmAsync(): Promise<StartupPrewarmResult> {
    this.disableFrustumCulling();
    try {
      for (const task of this.tasks) await task.prepare();
      await this.graphics.compileScenesOnceAsync();
      this.graphics.render();
      return { completed: true };
    } catch (error) {
      return { completed: false, error };
    } finally {
      this.restore();
    }
  }

  private disableFrustumCulling() {
    this.frustumCullStates = [];
    for (const scene of this.stage.scenes)
      scene.traverse((object) => {
        this.frustumCullStates.push({
          object,
          frustumCulled: object.frustumCulled,
        });
        object.frustumCulled = false;
      });
  }

  private restore() {
    for (const task of this.tasks) task.restore();
    for (const { object, frustumCulled } of this.frustumCullStates)
      object.frustumCulled = frustumCulled;
  }
}
