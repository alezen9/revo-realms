import "./style.css";
import _SetupManager from "./systems/_SetupManager";
import Game from "./Game";
import uiManager from "./systems/UIManager";
// import PerformanceMonitor from "./systems/PerformanceMonitor";

// new PerformanceMonitor(60);

const _setupManager = new _SetupManager();

_setupManager.initAsync().then(() => {
  uiManager.init();
  const game = new Game();
  game.startLoop();
});
