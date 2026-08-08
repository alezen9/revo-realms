import "./style.css";
import Game from "./Game";
import { mountUi } from "./ui/mountUi";
import { setupAsync } from "./systems/setupAsync";
import { eventsManager, prewarmManager } from "./systems";

const bootstrap = async () => {
  mountUi();

  try {
    await setupAsync();
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

    game.startLoop();
  } catch (error) {
    console.error("[main] Startup failed.", error);
    eventsManager.emit("engine-loading-failed");
  }
};

bootstrap();
