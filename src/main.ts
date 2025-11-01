import "./style.css";
import _SetupManager from "./systems/_SetupManager";
import Game from "./Game";

const _setupManager = new _SetupManager();

_setupManager.initAsync().then(() => {
  const game = new Game();
  game.startLoop();
});
