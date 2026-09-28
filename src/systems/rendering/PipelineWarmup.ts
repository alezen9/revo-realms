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

  constructor(graphics: Graphics, stage: Stage) {
    this.graphics = graphics;
    this.stage = stage;
  }

  registerTask(task: PrewarmTask) {
    this.tasks.push(task);
  }

  private collectFrustumCullStates() {
    const states: FrustumCullState[] = [];
    for (const scene of this.stage.scenes)
      scene.traverse((object) => {
        states.push({
          object,
          frustumCulled: object.frustumCulled,
        });
      });
    return states;
  }

  private setFrustumCullStates(states: FrustumCullState[], enabled: boolean) {
    states.forEach(({ object }) => {
      object.frustumCulled = enabled;
    });
  }

  private restoreFrustumCullStates(states: FrustumCullState[]) {
    states.forEach(({ object, frustumCulled }) => {
      object.frustumCulled = frustumCulled;
    });
  }

  async runStartupPrewarmAsync(): Promise<StartupPrewarmResult> {
    const states = this.collectFrustumCullStates();
    this.setFrustumCullStates(states, false);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    let restored = false;

    const restoreOnce = () => {
      if (restored) return;
      this.tasks.forEach((task) => task.restore());
      this.restoreFrustumCullStates(states);
      restored = true;
    };

    const prewarmPromise = (async (): Promise<StartupPrewarmResult> => {
      try {
        for (const task of this.tasks) await task.prepare();
        await this.graphics.compileScenesOnceAsync();
        if (!timedOut) this.graphics.render();
        restoreOnce();
        return {
          completed: !timedOut,
          timedOut,
        };
      } catch (error) {
        restoreOnce();
        return {
          completed: false,
          timedOut: false,
          error,
        };
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }
    })();

    const timeoutPromise = new Promise<StartupPrewarmResult>((resolve) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        restoreOnce();
        resolve({
          completed: false,
          timedOut: true,
        });
      }, PREWARM_TIMEOUT_MS);
    });

    return Promise.race([prewarmPromise, timeoutPromise]);
  }
}
