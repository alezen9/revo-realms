import { Object3D } from "three";
import type { RendererManager } from "./RendererManager/RendererManager";
import type { SceneManager } from "./SceneManager";

const PREWARM_TIMEOUT_MS = 2500;

export type StartupPrewarmResult = {
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

export class PrewarmManager {
  private rendererManager: RendererManager;
  private sceneManager: SceneManager;
  private tasks: PrewarmTask[] = [];

  constructor(rendererManager: RendererManager, sceneManager: SceneManager) {
    this.rendererManager = rendererManager;
    this.sceneManager = sceneManager;
  }

  registerTask(task: PrewarmTask) {
    this.tasks.push(task);
  }

  private collectFrustumCullStates() {
    const states: FrustumCullState[] = [];
    for (const scene of this.sceneManager.scenes)
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
        await this.rendererManager.compileScenesOnceAsync();
        if (!timedOut) this.rendererManager.render();
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
