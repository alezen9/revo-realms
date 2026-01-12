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
  inputManager,
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

export default class Game {
  private player: Player;
  private readonly IS_CAP_FPS_ENABLED = import.meta.env.DEV && ENABLE_CAP_FPS;
  private config = {
    halvenFPS: false,
  };
  private timeState = {
    isPaused: false,
    isSlowMotion: false,
    isMenuSlow: false,
    slowMotionScale: 0.1,
  };
  private timeScale = 1;

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

  private applyTimeScale() {
    const isSlowed = this.timeState.isSlowMotion || this.timeState.isMenuSlow;
    const nextScale = this.timeState.isPaused
      ? 0
      : isSlowed
        ? this.timeState.slowMotionScale
        : 1;
    if (this.timeScale === nextScale) return;
    this.timeScale = nextScale;
    rendererManager.setTimeScale(nextScale);
    if (nextScale > 0) physicsManager.setTimeScale(nextScale);
  }

  private togglePause() {
    this.timeState.isPaused = !this.timeState.isPaused;
    this.applyTimeScale();
  }

  private toggleSlowMotion() {
    this.timeState.isSlowMotion = !this.timeState.isSlowMotion;
    this.applyTimeScale();
  }

  private bindTimeControls() {
    inputManager.onKeyDown("KeyP", () => this.togglePause());
    inputManager.onKeyDown("KeyT", () => this.toggleSlowMotion());
    eventsManager.on("radial-menu-visibility", (visible) => {
      this.timeState.isMenuSlow = visible;
      this.applyTimeScale();
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
    this.config.halvenFPS = refreshRate > 120;
  }

  private onResize() {
    const sizes = this.getSizes();
    eventsManager.emit("engine-render-target-resize", sizes);
    this.updateRefreshRate();
  }

  async startLoop() {
    await this.updateRefreshRate();
    this.debugGame();
    this.bindTimeControls();
    this.applyTimeScale();
    const clock = new Clock(true);

    const state: State = { delta: clock.getDelta(), player: this.player };

    let flip = false;

    const loop = () => {
      if (this.timeScale === 0) {
        clock.getDelta();
        return;
      }
      physicsManager.update();
      if (this.config.halvenFPS) flip = !flip;
      else flip = false;
      if (flip || !this.config.halvenFPS) {
        if (import.meta.env.DEV) sceneManager.update();
        state.delta = clock.getDelta() * this.timeScale;
        eventsManager.emit("engine-update", state);
        rendererManager.renderAsync();
      }
    };

    // resize & start
    const debouncedResize = debounce(this.onResize.bind(this), 300);
    this.onResize();
    const resizeObserver = new ResizeObserver(debouncedResize);
    resizeObserver.observe(document.body);

    rendererManager.renderer.setAnimationLoop(loop);
  }
}
