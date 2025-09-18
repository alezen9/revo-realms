import { Clock } from "three";
import Player from "./entities/Player";
import PortfolioRealm from "./realms/PortfolioRealm";
import { sceneManager } from "./systems/SceneManager";
import { physicsManager } from "./systems/PhysicsManager";
import { rendererManager } from "./systems/RendererManager";
import { eventsManager } from "./systems/EventsManager";
import { debounce } from "lodash-es";

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

  constructor() {
    this.player = new Player();
    new PortfolioRealm();
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
    eventsManager.emit("resize", sizes);
  }

  async startLoop() {
    const clock = new Clock(true);

    const state: State = {
      clock,
      player: this.player,
    };

    const loop = async () => {
      if (import.meta.env.DEV) sceneManager.update();
      physicsManager.update();
      eventsManager.emit("update", state);

      rendererManager.renderAsync();
    };

    // On resize
    const debouncedResize = debounce(this.onResize.bind(this), 300);
    this.onResize();
    const resizeObserver = new ResizeObserver(debouncedResize);
    resizeObserver.observe(document.body);

    rendererManager.renderer.setAnimationLoop(loop);
  }
}
