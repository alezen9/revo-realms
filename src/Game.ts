import { Timer } from "three";
import Player from "./entities/Player";
import RevoRealm from "./realm/RevoRealm";
import { debounce } from "lodash-es";
import {
  frameScheduler,
  physicsManager,
  rendererManager,
  sceneManager,
  eventsManager,
  timeManager,
  monitoringManager,
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

  constructor() {
    this.player = new Player();
    new RevoRealm();
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
    timeManager.reset();
    const timer = new Timer();
    timer.connect(document);

    const state: State = { delta: 0, player: this.player };

    const loop = (timestamp: DOMHighResTimeStamp) => {
      timer.update(timestamp);

      if (timeManager.isPaused) {
        frameScheduler.reset();
        return;
      }

      const frame = frameScheduler.update(timer.getDelta());
      if (!frame.shouldTick) return;

      const frameWorkStart = performance.now();
      state.delta = timeManager.update(frame.delta);

      eventsManager.emit("engine-pre-physics-update", state);
      physicsManager.update(state.delta);
      eventsManager.emit("engine-post-physics-update", state);
      if (import.meta.env.DEV) sceneManager.update();
      eventsManager.emit("engine-update", state);
      rendererManager.renderAsync();
      const frameWorkDuration = (performance.now() - frameWorkStart) / 1000;
      frameScheduler.recordFrameWorkDuration(frameWorkDuration);
      monitoringManager?.sample();
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
