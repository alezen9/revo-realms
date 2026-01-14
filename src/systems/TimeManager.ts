import type { DebugManager } from "./DebugManager";
import type { EventsManager } from "./EventsManager";
import type { InputManager } from "./InputManager";
import { GameTime } from "../utils/GameTime";

type TimeState = {
  isPaused: boolean;
  isSlowMotion: boolean;
  isMenuSlow: boolean;
  slowMotionScale: number;
};

export class TimeManager {
  private state: TimeState = {
    isPaused: false,
    isSlowMotion: false,
    isMenuSlow: false,
    slowMotionScale: 0.125,
  };
  private timeScale = 1;
  private lastPauseState = false;
  private lastSlowMoState = false;

  constructor(
    private eventsManager: EventsManager,
    inputManager: InputManager,
    debugManager: DebugManager,
  ) {
    this.bindControls(inputManager);
    this.setupDebug(debugManager);
    this.eventsManager.on("radial-menu-visibility", (visible) => {
      this.setMenuSlow(visible);
    });
    this.emitInitialState();
  }

  get isPaused() {
    return this.state.isPaused;
  }

  reset() {
    GameTime.reset();
  }

  update(rawDeltaSeconds: number) {
    const scaledDelta = rawDeltaSeconds * this.timeScale;
    GameTime.update(scaledDelta);
    return scaledDelta;
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

  setMenuSlow(isMenuSlow: boolean) {
    this.updateState({ isMenuSlow });
  }

  setSlowMotionScale(scale: number) {
    this.updateState({ slowMotionScale: Math.max(0, scale) });
  }

  private computeTimeScale() {
    const { isPaused, isSlowMotion, isMenuSlow, slowMotionScale } = this.state;
    if (isPaused) return 0;
    const isSlowed = isSlowMotion || isMenuSlow;
    return isSlowed ? slowMotionScale : 1;
  }

  private updateState(update: Partial<TimeState>) {
    Object.assign(this.state, update);
    this.applyTimeScale();
  }

  private applyTimeScale() {
    const nextScale = this.computeTimeScale();
    if (this.timeScale !== nextScale) {
      this.timeScale = nextScale;
      this.eventsManager.emit("engine-time-scale", this.timeScale);
    }

    if (this.lastPauseState !== this.state.isPaused) {
      this.lastPauseState = this.state.isPaused;
      this.eventsManager.emit("engine-pause-change", this.state.isPaused);
    }

    if (this.lastSlowMoState !== this.state.isSlowMotion) {
      this.lastSlowMoState = this.state.isSlowMotion;
      this.eventsManager.emit("engine-slowmo-change", this.state.isSlowMotion);
    }
  }

  private emitInitialState() {
    this.timeScale = this.computeTimeScale();
    this.lastPauseState = this.state.isPaused;
    this.lastSlowMoState = this.state.isSlowMotion;
    this.eventsManager.emit("engine-time-scale", this.timeScale);
    this.eventsManager.emit("engine-pause-change", this.state.isPaused);
    this.eventsManager.emit("engine-slowmo-change", this.state.isSlowMotion);
  }

  private bindControls(inputManager: InputManager) {
    inputManager.onKeyDown("KeyP", () => this.togglePause());
    inputManager.onKeyDown("KeyT", () => this.toggleSlowMotion());
  }

  private setupDebug(debugManager: DebugManager) {
    const folder = debugManager.panel.addFolder({
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
