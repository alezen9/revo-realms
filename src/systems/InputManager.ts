import type { EventsManager } from "./EventsManager";

class KeyboardManager {
  private keysPressed = new Set<string>();
  private keyDownListeners = new Map<string, VoidFunction>();
  private eventsManager: EventsManager;

  constructor(eventsManager: EventsManager) {
    this.eventsManager = eventsManager;
    this.keysPressed = new Set();
    this.keyDownListeners = new Map();

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleBlur = this.handleBlur.bind(this);

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("wheel", this.handleWheel, { passive: true });
    window.addEventListener("blur", this.handleBlur);
  }

  private handleBlur() {
    this.keysPressed.clear();
  }

  private handleWheel(event: WheelEvent) {
    event.stopPropagation();
    if (event.deltaY <= 0 || Math.abs(event.deltaY) <= Math.abs(event.deltaX))
      return;
    this.eventsManager.emit("swipe-up");
  }

  private handleKeyDown(event: KeyboardEvent) {
    const code = event.code;
    if (!this.keysPressed.has(code)) {
      this.keysPressed.add(code);
      this.keyDownListeners.get(code)?.();
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    const code = event.code;
    this.keysPressed.delete(code);
  }

  isKeyPressed(code: string): boolean {
    if (code === "*") return this.keysPressed.size > 0;
    return this.keysPressed.has(code);
  }

  onKeyDown(code: string, callback: VoidFunction) {
    this.keyDownListeners.set(code, callback);
  }

  dispose() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("wheel", this.handleWheel);
    window.removeEventListener("blur", this.handleBlur);
  }
}

export class InputManager {
  private keyboardManager: KeyboardManager;

  constructor(eventsManager: EventsManager) {
    this.keyboardManager = new KeyboardManager(eventsManager);

    import.meta.hot?.dispose(() => {
      this.keyboardManager.dispose();
    });
  }

  isForward(): boolean {
    return (
      this.keyboardManager.isKeyPressed("KeyW") ||
      this.keyboardManager.isKeyPressed("ArrowUp")
    );
  }

  isBackward(): boolean {
    return (
      this.keyboardManager.isKeyPressed("KeyS") ||
      this.keyboardManager.isKeyPressed("ArrowDown")
    );
  }

  isLeftward(): boolean {
    return (
      this.keyboardManager.isKeyPressed("KeyA") ||
      this.keyboardManager.isKeyPressed("ArrowLeft")
    );
  }

  isRightward(): boolean {
    return (
      this.keyboardManager.isKeyPressed("KeyD") ||
      this.keyboardManager.isKeyPressed("ArrowRight")
    );
  }

  isJumpPressed(): boolean {
    return this.keyboardManager.isKeyPressed("Space");
  }

  onKeyDown(code: string, callback: VoidFunction) {
    this.keyboardManager.onKeyDown(code, callback);
  }
}
