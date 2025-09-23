import { Clock } from "three";
import Player from "./entities/Player";
import PortfolioRealm from "./realms/PortfolioRealm";
import { sceneManager } from "./systems/SceneManager";
import { physicsManager } from "./systems/PhysicsManager";
import { rendererManager } from "./systems/RendererManager";
import { eventsManager } from "./systems/EventsManager";
import { debounce } from "lodash-es";
import { debugManager } from "./systems/DebugManager";
import { getRefreshRate } from "./utils/getRefreshRate";

export type State = {
  clock: Clock;
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
  private ENABLE_CAP_FPS = false;
  private config = {
    halvenFPS: false,
  };

  constructor() {
    this.player = new Player();
    new PortfolioRealm();

    this.debugGame();
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
    if (!this.ENABLE_CAP_FPS) return;
    const refreshRate = await getRefreshRate();
    this.config.halvenFPS = refreshRate >= 120;
  }

  private onResize() {
    const sizes = this.getSizes();
    eventsManager.emit("resize", sizes);
    this.updateRefreshRate();
  }

  async startLoop() {
    await this.updateRefreshRate();
    const clock = new Clock(true);

    const state: State = { clock, player: this.player };

    let flip = false;

    const loop = () => {
      physicsManager.update();
      if (this.config.halvenFPS) flip = !flip;
      else flip = false;
      if (flip || !this.config.halvenFPS) {
        if (import.meta.env.DEV) sceneManager.update();
        eventsManager.emit("update", state);
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
