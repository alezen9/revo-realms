import { Timer } from "three";
import Player from "./entities/Player";
import RevoRealm from "./realm/RevoRealm";
import { debounce } from "lodash-es";
import {
  debugManager,
  physicsScheduler,
  rendererManager,
  sceneManager,
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

const MAX_FRAME_DELTA_SECONDS = 1 / 15;

export default class Game {
  private player: Player;
  private config = {
    targetFps: 120,
  };

  constructor() {
    this.player = new Player();
    new RevoRealm();
  }

  private debugGame() {
    const folder = debugManager.panel.addFolder({
      title: "⚡️ Performance",
      expanded: false,
    });
    folder
      .addBinding(this.config, "targetFps", {
        label: "Target FPS",
        options: {
          "60": 60,
          "120": 120,
        },
      })
      .on("change", ({ value }) => frameScheduler.setTargetFps(value));
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

  private onResize() {
    const sizes = this.getSizes();
    eventsManager.emit("engine-render-target-resize", sizes);
  }

  async startLoop() {
    await frameScheduler.initAsync(this.config.targetFps);
    this.debugGame();
    timeManager.reset();
    const timer = new Timer();
    timer.connect(document);

    const state: State = { delta: 0, player: this.player };

    let pendingDelta = 0;

    const loop = (timestamp: DOMHighResTimeStamp) => {
      timer.update(timestamp);
      const rawDelta = timer.getDelta();
      const clampedDelta = Math.min(rawDelta, MAX_FRAME_DELTA_SECONDS);
      pendingDelta += clampedDelta;

      frameScheduler.update();
      if (!frameScheduler.shouldRender) return;

      if (timeManager.isPaused) {
        pendingDelta = 0;
        return;
      }

      state.delta = timeManager.update(pendingDelta);
      pendingDelta = 0;

      physicsScheduler.update(state.delta);
      if (import.meta.env.DEV) sceneManager.update();
      eventsManager.emit("engine-update", state);
      rendererManager.renderAsync();
    };

    // resize & start
    const debouncedResize = debounce(this.onResize.bind(this), 300);
    this.onResize();
    const resizeObserver = new ResizeObserver(debouncedResize);
    resizeObserver.observe(document.body);

    import.meta.hot?.dispose(() => {
      resizeObserver.disconnect();
    });

    rendererManager.renderer.setAnimationLoop(loop);
  }
}
