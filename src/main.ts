import "./style.css";
import Game from "./Game";
import { _SetupManager } from "./systems/_SetupManager";
import RendererManager from "./systems/RendererManager";

const setupManager = new _SetupManager();

setupManager.initAsync().then((device) => {
  const renderer = new RendererManager(device);
  const game = new Game(renderer);
  game.startLoop();
});
