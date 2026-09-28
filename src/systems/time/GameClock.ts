import { Timer } from "three";
import type { DebugPanel } from "../debug/DebugPanel";
import type { EventBus } from "../events/EventBus";
import type { Input } from "../input/Input";
import { GameTime } from "./gameTime";
import { MAX_CATCH_UP_SECONDS } from "./PhysicsScheduler";

type TimeState = {
  isPaused: boolean;
  isSlowMotion: boolean;
  slowMotionScale: number;
};

export class GameClock {
  private eventBus: EventBus;
  private timer = new Timer();
  private state: TimeState = {
    isPaused: false,
    isSlowMotion: false,
    slowMotionScale: 0.125,
  };
  private pendingRenderDelta = 0;
  private timeScale = 1;
  private lastSlowMoState = false;
  delta = 0;
  discardedDelta = 0;

  constructor(eventBus: EventBus, input: Input, debugPanel: DebugPanel) {
    this.eventBus = eventBus;
    this.bindControls(input);
    this.setupDebug(debugPanel);
    this.emitInitialState();
  }

  get isPaused() {
    return this.state.isPaused;
  }

  reset() {
    this.timer.connect(document);
    this.pendingRenderDelta = 0;
    this.delta = 0;
    this.discardedDelta = 0;
    GameTime.reset();
  }

  update(timestamp: DOMHighResTimeStamp) {
    this.timer.update(timestamp);
    const rawDelta = this.timer.getDelta();
    const clampedDelta = Math.min(rawDelta, MAX_CATCH_UP_SECONDS);

    if (this.state.isPaused) {
      this.pendingRenderDelta = 0;
      this.delta = 0;
      this.discardedDelta = 0;
      return;
    }

    this.delta = clampedDelta * this.timeScale;
    this.discardedDelta = (rawDelta - clampedDelta) * this.timeScale;
    this.pendingRenderDelta += this.delta;
    GameTime.update(this.delta);
  }

  consumeRenderDelta() {
    const delta = this.pendingRenderDelta;
    this.pendingRenderDelta = 0;
    return delta;
  }

  togglePause() {
    this.setPaused(!this.state.isPaused);
  }

  toggleSlowMotion() {
    if (this.state.isPaused) return;
    this.setSlowMotionEnabled(!this.state.isSlowMotion);
  }

  setPaused(isPaused: boolean) {
    this.updateState({ isPaused });
  }

  setSlowMotionEnabled(isSlowMotion: boolean) {
    this.updateState({ isSlowMotion });
  }

  setSlowMotionScale(scale: number) {
    this.updateState({ slowMotionScale: Math.max(0, scale) });
  }

  private computeTimeScale() {
    const { isPaused, isSlowMotion, slowMotionScale } = this.state;
    if (isPaused) return 0;
    if (isSlowMotion) return slowMotionScale;
    return 1;
  }

  private updateState(update: Partial<TimeState>) {
    Object.assign(this.state, update);
    this.applyTimeScale();
  }

  private applyTimeScale() {
    this.timeScale = this.computeTimeScale();

    if (this.lastSlowMoState !== this.state.isSlowMotion) {
      this.lastSlowMoState = this.state.isSlowMotion;
      this.eventBus.emit("engine-slowmo-change", this.state.isSlowMotion);
    }
  }

  private emitInitialState() {
    this.timeScale = this.computeTimeScale();
    this.lastSlowMoState = this.state.isSlowMotion;
    this.eventBus.emit("engine-slowmo-change", this.state.isSlowMotion);
  }

  private bindControls(input: Input) {
    input.onKeyDown("KeyP", () => this.togglePause());
    input.onKeyDown("KeyT", () => this.toggleSlowMotion());
  }

  private setupDebug(debugPanel: DebugPanel) {
    const folder = debugPanel.panel.addFolder({
      title: "⏱️ Time",
      expanded: false,
    });

    folder
      .addBinding(this.state, "isPaused", { label: "Paused" })
      .on("change", ({ value }) => this.setPaused(value));
    folder
      .addBinding(this.state, "isSlowMotion", { label: "Slow motion" })
      .on("change", ({ value }) => this.setSlowMotionEnabled(value));
    folder
      .addBinding(this.state, "slowMotionScale", {
        label: "Slow scale",
        min: 0,
        max: 1,
        step: 0.01,
      })
      .on("change", ({ value }) => this.setSlowMotionScale(value));
  }
}
