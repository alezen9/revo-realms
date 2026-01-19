import { Clock } from "three";
import Player from "./entities/Player";
import RevoRealm from "./realm/RevoRealm";
import { debounce } from "lodash-es";
import {
  debugManager,
  physicsManager,
  rendererManager,
  sceneManager,
  eventsManager,
  timeManager,
} from "./systems";
import { Utils } from "./utils/Utils";

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

const ENABLE_CAP_FPS = true;
const AUTO_HALF_FPS_THRESHOLD = 120; // Hz

export default class Game {
  private player: Player;
  private readonly IS_CAP_FPS_ENABLED = import.meta.env.DEV && ENABLE_CAP_FPS;
  private config = {
    halvenFPS: false,
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
    folder.addBinding(this.config, "halvenFPS", {
      label: "Halven FPS",
    });
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

  private async updateRefreshRate() {
    if (!this.IS_CAP_FPS_ENABLED) return;
    const refreshRate = await Utils.getRefreshRate();
    this.config.halvenFPS = refreshRate > AUTO_HALF_FPS_THRESHOLD;
  }

  private onResize() {
    const sizes = this.getSizes();
    eventsManager.emit("engine-render-target-resize", sizes);
    this.updateRefreshRate();
  }

  async startLoop() {
    await this.updateRefreshRate();
    this.debugGame();
    timeManager.reset();
    const clock = new Clock(true);

    const state: State = { delta: clock.getDelta(), player: this.player };

    let flip = false;
    let pendingDelta = 0;

    const loop = () => {
      pendingDelta += clock.getDelta();
      const shouldTick = this.config.halvenFPS ? (flip = !flip) : true;
      if (!shouldTick) return;
      state.delta = timeManager.update(pendingDelta);
      pendingDelta = 0;
      if (timeManager.isPaused) return;
      physicsManager.update(state.delta);
      if (import.meta.env.DEV) sceneManager.update();
      eventsManager.emit("engine-update", state);
      rendererManager.renderAsync();
    };

    // resize & start
    const debouncedResize = debounce(this.onResize.bind(this), 300);
    this.onResize();
    const resizeObserver = new ResizeObserver(debouncedResize);
    resizeObserver.observe(document.body);

    rendererManager.renderer.setAnimationLoop(loop);
  }
}
