import { Object3D } from "three";
import type { Graphics } from "./Graphics";
import type { Stage } from "../scene/Stage";

const PREWARM_TIMEOUT_MS = 2500;

type StartupPrewarmResult = {
  completed: boolean;
  timedOut: boolean;
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
  private timeoutId?: ReturnType<typeof setTimeout>;
  private hasTimedOut = false;
  private isRestored = false;

  constructor(graphics: Graphics, stage: Stage) {
    this.graphics = graphics;
    this.stage = stage;
  }

  registerTask(task: PrewarmTask) {
    this.tasks.push(task);
  }

  runStartupPrewarmAsync() {
    this.disableFrustumCulling();
    const timeoutPromise = new Promise<StartupPrewarmResult>((resolve) => {
      this.timeoutId = setTimeout(() => {
        this.hasTimedOut = true;
        this.restoreOnce();
        resolve({ completed: false, timedOut: true });
      }, PREWARM_TIMEOUT_MS);
    });
    return Promise.race([this.prewarmAsync(), timeoutPromise]);
  }

  private async prewarmAsync(): Promise<StartupPrewarmResult> {
    try {
      for (const task of this.tasks) await task.prepare();
      await this.graphics.compileScenesOnceAsync();
      if (!this.hasTimedOut) this.graphics.render();
      this.restoreOnce();
      return { completed: !this.hasTimedOut, timedOut: this.hasTimedOut };
    } catch (error) {
      this.restoreOnce();
      return { completed: false, timedOut: false, error };
    } finally {
      clearTimeout(this.timeoutId);
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

  private restoreOnce() {
    if (this.isRestored) return;
    this.isRestored = true;
    for (const task of this.tasks) task.restore();
    for (const { object, frustumCulled } of this.frustumCullStates)
      object.frustumCulled = frustumCulled;
  }
}
