import { Clock } from "three";
import Player from "./entities/Player";
import PortfolioRealm from "./realms/PortfolioRealm";
import { sceneManager } from "./systems/SceneManager";
import { physicsManager } from "./systems/PhysicsManager";
import { rendererManager } from "./systems/RendererManager";
import { eventsManager } from "./systems/EventsManager";

export type State = {
  clock: Clock;
  player: Player;
};

type Sizes = { width: number; height: number; dpr: number; aspect: number };

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
    // Update camera
    sceneManager.playerCamera.aspect = sizes.aspect;
    sceneManager.playerCamera.updateProjectionMatrix();

    // Update renderer
    rendererManager.renderer.setSize(sizes.width, sizes.height);
    rendererManager.renderer.setPixelRatio(sizes.dpr);
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
    const resizeObserver = new ResizeObserver(() => {
      this.onResize();
    });
    resizeObserver.observe(document.body);

    rendererManager.renderer.setAnimationLoop(loop);
  }
}
