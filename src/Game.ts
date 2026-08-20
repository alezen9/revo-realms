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
      renderDivisor: frameScheduler.divisor,
    };

    const cadences = frameScheduler.getRenderCadences();
    const options = cadences.reduce((acc, cadence) => {
      const formattedLabel = cadence.fps.toFixed(2);
      acc[formattedLabel] = cadence.divisor;
      return acc;
    }, {});

    folder
      .addBinding(config, "renderDivisor", {
        label: "Render FPS",
        options,
      })
      .on("change", ({ value }) => frameScheduler.setRenderDivisor(value));

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

    frameScheduler.update();
    if (!frameScheduler.shouldRender) return;

    this.renderState.delta = timeManager.consumeRenderDelta();

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
