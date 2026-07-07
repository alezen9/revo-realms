import Player from "./entities/Player";
import RevoRealm from "./realm/RevoRealm";
import { debounce } from "lodash-es";
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
  private state: State;
  private resizeObserver?: ResizeObserver;

  constructor() {
    this.player = new Player();
    this.state = { delta: 0, player: this.player };
    new RevoRealm();
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

  private onAnimationFrame = (timestamp: DOMHighResTimeStamp) => {
    timeManager.update(timestamp);
    if (timeManager.isPaused) return;

    physicsScheduler.update(timeManager.delta);

    if (physicsScheduler.shouldStep) {
      this.state.delta = physicsScheduler.fixedDelta;

      eventsManager.emit("engine-before-physics", this.state);
      const didStep = physicsManager.step();

      if (didStep) {
        eventsManager.emit("engine-after-physics", this.state);
        physicsManager.completeStep();
      }
    }

    frameScheduler.update();
    if (!frameScheduler.shouldRender) return;

    this.state.delta = timeManager.consumeRenderDelta();

    eventsManager.emit("engine-render-update", this.state);
    rendererManager.render();

    monitoringManager?.sample(timestamp);
  };

  private dispose = () => {
    this.resizeObserver?.disconnect();
  };

  async startLoop() {
    await frameScheduler.initAsync();
    this.debugGame();
    timeManager.reset();

    const debouncedResize = debounce(this.onResize, 300);
    this.onResize();
    this.resizeObserver = new ResizeObserver(debouncedResize);
    this.resizeObserver.observe(document.body);

    import.meta.hot?.dispose(this.dispose);

    rendererManager.renderer.setAnimationLoop(this.onAnimationFrame);
  }
}
