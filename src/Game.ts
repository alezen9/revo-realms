import Player from "./entities/Player/Player";
import RevoRealm from "./realm/RevoRealm";
import { debounce } from "lodash-es";
import { rendererConfig } from "./systems/RendererManager/RendererManager";
import {
  debugManager,
  monitoringManager,
  physicsManager,
  physicsScheduler,
  rendererManager,
  eventsManager,
  timeManager,
  frameScheduler,
  resolutionScheduler,
} from "./systems";

export type State = {
  delta: number;
  player: Player;
};

export type Sizes = {
  width: number;
  height: number;
  dpr: number;
  aspect: number;
};

export default class Game {
  private player: Player;
  private physicsState: State;
  private renderState: State;
  private resizeObserver?: ResizeObserver;
  private hasRenderedFirstFrame = false;

  constructor() {
    this.player = new Player();
    this.physicsState = {
      delta: physicsScheduler.fixedDelta,
      player: this.player,
    };
    this.renderState = { delta: 0, player: this.player };
    new RevoRealm();
    this.onResize();
  }

  private debugGame() {
    const folder = debugManager.panel.addFolder({
      title: "⚡️ Performance",
      expanded: false,
    });
    const config = {
      renderFps: frameScheduler.effectiveFps,
      scaleStepIndex: resolutionScheduler.stepIndex,
      isDynamicResolution: resolutionScheduler.isEnabled,
      minScaleStepIndex: resolutionScheduler.minStepIndex,
    };

    const cadences = frameScheduler.getRenderCadences();
    const options = cadences.reduce((acc, cadence) => {
      const formattedLabel = cadence.fps.toFixed(2);
      acc[formattedLabel] = cadence.fps;
      return acc;
    }, {});

    folder
      .addBinding(config, "renderFps", {
        label: "Render FPS",
        options,
      })
      .on("change", ({ value }) => frameScheduler.setTargetFps(value));

    const scaleOptions = resolutionScheduler.steps.reduce(
      (acc, scale, index) => {
        acc[scale.toFixed(2)] = index;
        return acc;
      },
      {},
    );

    folder
      .addBinding(config, "scaleStepIndex", {
        label: "Render scale",
        options: scaleOptions,
      })
      .on("change", ({ value }) => {
        const scale = resolutionScheduler.setStepIndex(value);
        rendererManager.setDynamicResolutionScale(scale);
      });

    folder
      .addBinding(config, "isDynamicResolution", {
        label: "Dynamic resolution",
      })
      .on("change", ({ value }) => resolutionScheduler.setEnabled(value));

    folder
      .addBinding(config, "minScaleStepIndex", {
        label: "Min render scale",
        options: scaleOptions,
      })
      .on("change", ({ value }) => {
        resolutionScheduler.minStepIndex = value;
      });

    folder.addBinding(resolutionScheduler, "scale", {
      label: "Live render scale",
      readonly: true,
    });

    folder
      .addBinding(rendererConfig, "resolutionScale", {
        label: "Resolution scale",
        min: 0.4,
        max: 1,
        step: 0.05,
      })
      .on("change", () => rendererManager.applyResolution());
  }

  private getSizes(): Sizes {
    const width = window.innerWidth;
    const height = window.innerHeight;
    return {
      width,
      height,
      dpr: Math.min(window.devicePixelRatio, 1.5),
      aspect: width / height,
    };
  }

  private onResize = () => {
    const sizes = this.getSizes();
    eventsManager.emit("engine-render-target-resize", sizes);
  };

  private onResizeDebounced = debounce(this.onResize, 300);

  private onAnimationFrame = (timestamp: DOMHighResTimeStamp) => {
    timeManager.update(timestamp);
    if (timeManager.isPaused) return;

    physicsScheduler.update(timeManager.delta);

    for (let i = 0; i < physicsScheduler.pendingSteps; i++) {
      eventsManager.emit("engine-before-physics", this.physicsState);
      physicsManager.step();
      eventsManager.emit("engine-after-physics", this.physicsState);
      physicsManager.flush();
    }
    monitoringManager?.samplePhysics();

    frameScheduler.update(timestamp);
    if (!frameScheduler.shouldRender) return;

    this.renderState.delta = timeManager.consumeRenderDelta();

    const budgetMs = 1000 / frameScheduler.effectiveFps;
    if (resolutionScheduler.update(timestamp, budgetMs))
      rendererManager.setDynamicResolutionScale(resolutionScheduler.scale);

    monitoringManager?.sampleRender(timestamp);
    eventsManager.emit("engine-render-update", this.renderState);
    rendererManager.render();

    if (!this.hasRenderedFirstFrame) {
      this.hasRenderedFirstFrame = true;
      eventsManager.emit("engine-loading-core-progress", 100);
    }
  };

  private dispose = () => {
    rendererManager.renderer.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.onResizeDebounced.cancel();
  };

  async startLoop() {
    await frameScheduler.initAsync();
    this.debugGame();
    timeManager.reset();

    this.onResize();
    this.resizeObserver = new ResizeObserver(this.onResizeDebounced);
    this.resizeObserver.observe(document.body);

    import.meta.hot?.dispose(this.dispose);

    rendererManager.renderer.setAnimationLoop(this.onAnimationFrame);
  }
}
