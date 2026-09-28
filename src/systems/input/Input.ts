import type { EventBus } from "../events/EventBus";

export class Input {
  private keysPressed = new Set<string>();
  private keyDownListeners = new Map<string, VoidFunction>();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    window.addEventListener("keydown", this.onWindowKeyDown);
    window.addEventListener("keyup", this.onWindowKeyUp);
    window.addEventListener("wheel", this.onWindowWheel, { passive: true });
    window.addEventListener("blur", this.onWindowBlur);
    import.meta.hot?.dispose(this.dispose);
  }

  isForward() {
    return this.keysPressed.has("KeyW") || this.keysPressed.has("ArrowUp");
  }

  isBackward() {
    return this.keysPressed.has("KeyS") || this.keysPressed.has("ArrowDown");
  }

  isLeftward() {
    return this.keysPressed.has("KeyA") || this.keysPressed.has("ArrowLeft");
  }

  isRightward() {
    return this.keysPressed.has("KeyD") || this.keysPressed.has("ArrowRight");
  }

  isJumpPressed() {
    return this.keysPressed.has("Space");
  }

  onKeyDown(code: string, callback: VoidFunction) {
    this.keyDownListeners.set(code, callback);
  }

  private onWindowKeyDown = (event: KeyboardEvent) => {
    const { code } = event;
    if (this.keysPressed.has(code)) return;
    this.keysPressed.add(code);
    const listener = this.keyDownListeners.get(code);
    if (listener) listener();
  };

  private onWindowKeyUp = (event: KeyboardEvent) => {
    this.keysPressed.delete(event.code);
  };

  private onWindowWheel = (event: WheelEvent) => {
    event.stopPropagation();
    const isScrollingUp = event.deltaY > 0;
    const isMostlyVertical = Math.abs(event.deltaY) > Math.abs(event.deltaX);
    if (!isScrollingUp || !isMostlyVertical) return;
    this.eventBus.emit("swipe-up");
  };

  private onWindowBlur = () => {
    this.keysPressed.clear();
  };

  private dispose = () => {
    window.removeEventListener("keydown", this.onWindowKeyDown);
    window.removeEventListener("keyup", this.onWindowKeyUp);
    window.removeEventListener("wheel", this.onWindowWheel);
    window.removeEventListener("blur", this.onWindowBlur);
  };
}
