import { Assets } from "./assets/Assets";
import { Sound } from "./audio/Sound";
import { FrustumCulling } from "./rendering/FrustumCulling";
import { EventBus } from "./events/EventBus";
import { FrameScheduler } from "./time/FrameScheduler";
import { Input } from "./input/Input";
import { Landmarks } from "./world/Landmarks";
import { Lighting } from "./lighting/Lighting";
import { PhysicsWorld } from "./physics/PhysicsWorld";
import { PhysicsScheduler } from "./time/PhysicsScheduler";
import { Graphics } from "./rendering/Graphics";
import { Stage } from "./scene/Stage";
import { GameClock } from "./time/GameClock";
import { Wind } from "./world/Wind";
import { PipelineWarmup } from "./rendering/PipelineWarmup";
import { DebugPanel } from "./debug/DebugPanel";
import { PerformanceMonitor } from "./monitoring/PerformanceMonitor";

const init = () => {
  const eventBus = new EventBus();
  const frameScheduler = new FrameScheduler();
  const assets = new Assets(eventBus);
  const stage = new Stage(eventBus);
  const frustumCulling = new FrustumCulling(eventBus, stage);
  const debugPanel = new DebugPanel();

  const graphics = new Graphics(stage, debugPanel, eventBus);
  const pipelineWarmup = new PipelineWarmup(graphics, stage);
  const sound = new Sound(stage, eventBus);
  const input = new Input(eventBus);
  const physicsWorld = new PhysicsWorld(stage, sound, debugPanel);
  const physicsScheduler = new PhysicsScheduler();
  const gameClock = new GameClock(eventBus, input, debugPanel);
  const performanceMonitor = new PerformanceMonitor(
    eventBus,
    graphics,
    frameScheduler,
    physicsScheduler,
    gameClock,
  );
  const landmarks = new Landmarks();
  const lighting = new Lighting(stage, debugPanel, eventBus, assets);
  const wind = new Wind(eventBus);
  return {
    eventBus,
    frameScheduler,
    lighting,
    stage,
    frustumCulling,
    graphics,
    performanceMonitor,
    pipelineWarmup,
    assets,
    sound,
    debugPanel,
    input,
    physicsWorld,
    physicsScheduler,
    gameClock,
    landmarks,
    wind,
  };
};

export const {
  eventBus,
  frameScheduler,
  lighting,
  stage,
  frustumCulling,
  graphics,
  performanceMonitor,
  pipelineWarmup,
  assets,
  sound,
  debugPanel,
  input,
  physicsWorld,
  physicsScheduler,
  gameClock,
  landmarks,
  wind,
} = init();
