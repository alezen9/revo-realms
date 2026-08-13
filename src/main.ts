import "./style.css";
import Game from "./Game";
import { mountUi } from "./ui/mountUi";
import { setupAsync } from "./systems/setupAsync";
import { eventsManager, prewarmManager } from "./systems";

const hasWebGpuSupportAsync = async () => {
  if (!navigator.gpu) return false;

  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    return adapter !== null;
  } catch {
    return false;
  }
};

const bootstrap = async () => {
  mountUi();

  const doesSupportWebGpu = await hasWebGpuSupportAsync();
  if (!doesSupportWebGpu) {
    console.error("[main] Startup failed.", "WebGPU is required");
    eventsManager.emit("engine-loading-failed", {
      headline: "WebGPU is required",
      hint: "This experience relies on WebGPU-specific rendering and simulation features. Please use a browser and device that support WebGPU.",
    });
    return;
  }

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
