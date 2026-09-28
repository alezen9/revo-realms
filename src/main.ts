import "./style.css";
import { Game } from "./Game";
import { mountUi } from "./ui/mountUi";
import { DebugCameraControls } from "./systems/scene/DebugCameraControls";
import { TOOLING_FLAGS } from "./systems/debug/toolingFlags";
import {
  assets,
  debugPanel,
  eventBus,
  graphics,
  lighting,
  performanceMonitor,
  physicsWorld,
  pipelineWarmup,
  sound,
  stage,
} from "./systems";

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

const setupSystemsAsync = async () => {
  eventBus.emit("engine-loading-core-progress", 0);
  await debugPanel.initAsync();
  await graphics.init();
  if (TOOLING_FLAGS.debug)
    new DebugCameraControls(stage, graphics.canvas, eventBus, debugPanel);
  await performanceMonitor.initAsync();
  eventBus.emit("engine-loading-core-progress", 25);
  await Promise.all([physicsWorld.initAsync(), assets.initAsync(graphics)]);
  graphics.initFramePipeline({ lighting, assets, performanceMonitor });
  eventBus.emit("engine-loading-core-progress", 75);
  sound
    .initAsync()
    .catch((error) => console.error("[setup] Audio init failed.", error)); // bg loading
};

const bootstrap = async () => {
  mountUi();

  const doesSupportWebGpu = await hasWebGpuSupportAsync();
  if (!doesSupportWebGpu) {
    console.error("[main] Startup failed.", "WebGPU is required");
    eventBus.emit("engine-loading-failed", {
      headline: "WebGPU is required",
      hint: "This experience relies on WebGPU-specific rendering and simulation features. Please use a browser and device that support WebGPU.",
    });
    return;
  }

  try {
    await setupSystemsAsync();
    const game = new Game();
    eventBus.emit("engine-loading-core-progress", 90);

    const { completed, timedOut, error } =
      await pipelineWarmup.runStartupPrewarmAsync();
    if (completed && import.meta.env.DEV)
      console.info("[main] Prewarm completed.");
    if (timedOut) console.warn("[main] Prewarm timed out. Continuing startup.");
    if (error)
      console.error("[main] Prewarm failed. Continuing startup.", error);

    await game.startLoopAsync();
  } catch (error) {
    console.error("[main] Startup failed.", error);
    eventBus.emit("engine-loading-failed");
  }
};

bootstrap();
