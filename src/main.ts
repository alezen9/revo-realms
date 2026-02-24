import "./style.css";
import _SetupManager from "./systems/_SetupManager";
import Game from "./Game";
import { UIManager } from "./systems/UIManager";
import {
  eventsManager,
  prewarmManager,
} from "./systems";

const _setupManager = new _SetupManager();
const _uiManager = new UIManager();

const bootstrap = async () => {
  try {
    await _setupManager.initAsync();
    const game = new Game();
    eventsManager.emit("engine-loading-core-progress", 90);

    const prewarmResult = await prewarmManager.runStartupPrewarmAsync();
    const isDev = import.meta.env.DEV;
    if (prewarmResult.completed && isDev)
      console.info("[main] Prewarm completed.");
    else if (prewarmResult.timedOut)
      console.warn("[main] Prewarm timed out. Continuing startup.");
    else if (prewarmResult.error)
      console.error(
        "[main] Prewarm failed. Continuing startup.",
        prewarmResult.error,
      );
    else console.warn("[main] Prewarm exited early. Continuing startup.");

    eventsManager.emit("engine-loading-core-progress", 100);
    game.startLoop();
  } catch (error) {
    console.error("[main] Startup failed.", error);
  }
};

bootstrap();
