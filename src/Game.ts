import Player from "./entities/player/Player";
import RevoRealm from "./entities/RevoRealm";
import { debounce } from "lodash-es";
import { rendererConfig } from "./systems/rendering/Graphics";
import {
  debugPanel,
  performanceMonitor,
  physicsWorld,
  physicsScheduler,
  graphics,
  eventBus,
  gameClock,
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
    const folder = debugPanel.panel.addFolder({
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
      .on("change", () => graphics.applyResolution());
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
    eventBus.emit("engine-render-target-resize", sizes);
  };

  private onResizeDebounced = debounce(this.onResize, 300);

  private onAnimationFrame = (timestamp: DOMHighResTimeStamp) => {
    gameClock.update(timestamp);
    if (gameClock.isPaused) return;

    physicsScheduler.update(gameClock.delta);

    for (let i = 0; i < physicsScheduler.pendingSteps; i++) {
      eventBus.emit("engine-before-physics", this.physicsState);
      physicsWorld.step();
      eventBus.emit("engine-after-physics", this.physicsState);
      physicsWorld.flush();
    }
    performanceMonitor.samplePhysics();

    frameScheduler.update();
    if (!frameScheduler.shouldRender) return;

    this.renderState.delta = gameClock.consumeRenderDelta();

    performanceMonitor.sampleRender(timestamp);
    eventBus.emit("engine-render-update", this.renderState);
    graphics.render();

    if (!this.hasRenderedFirstFrame) {
      this.hasRenderedFirstFrame = true;
      eventBus.emit("engine-loading-core-progress", 100);
    }
  };

  private dispose = () => {
    graphics.renderer.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.onResizeDebounced.cancel();
  };

  async startLoopAsync() {
    await frameScheduler.initAsync();
    this.debugGame();
    gameClock.reset();

    this.onResize();
    this.resizeObserver = new ResizeObserver(this.onResizeDebounced);
    this.resizeObserver.observe(document.body);

    import.meta.hot?.dispose(this.dispose);

    graphics.renderer.setAnimationLoop(this.onAnimationFrame);
  }
}
