import "./style.css";
import _SetupManager from "./systems/_SetupManager";
import Game from "./Game";
// import PerformanceMonitor from "./systems/PerformanceMonitor";

// new PerformanceMonitor(60);

const _setupManager = new _SetupManager();

_setupManager.initAsync().then(() => {
  const game = new Game();
  game.startLoop();
});
