class InputManager {
  private keysPressed: Set<string>;
  private keyDownListeners: Map<string, VoidFunction>;
  private keyUpListeners: Map<string, VoidFunction>;

  constructor() {
    this.keysPressed = new Set();
    this.keyDownListeners = new Map();
    this.keyUpListeners = new Map();

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  private handleKeyDown(event: KeyboardEvent) {
    const code = event.code; // e.g. "KeyW", "ArrowUp", etc.
    if (!this.keysPressed.has(code)) {
      this.keysPressed.add(code);
      this.keyDownListeners.get(code)?.();
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    const code = event.code;
    this.keysPressed.delete(code);
    this.keyUpListeners.get(code)?.();
  }

  public isKeyPressed(code: string): boolean {
    if (code === "*") return this.keysPressed.size > 0;
    return this.keysPressed.has(code);
  }

  public onKeyDown(code: string, callback: VoidFunction) {
    this.keyDownListeners.set(code, callback);
  }

  public onKeyUp(code: string, callback: VoidFunction) {
    this.keyUpListeners.set(code, callback);
  }

  public dispose() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  public isForward(): boolean {
    return this.isKeyPressed("KeyW") || this.isKeyPressed("ArrowUp");
  }

  public isBackward(): boolean {
    return this.isKeyPressed("KeyS") || this.isKeyPressed("ArrowDown");
  }

  public isLeftward(): boolean {
    return this.isKeyPressed("KeyA") || this.isKeyPressed("ArrowLeft");
  }

  public isRightward(): boolean {
    return this.isKeyPressed("KeyD") || this.isKeyPressed("ArrowRight");
  }

  public isJumpPressed(): boolean {
    return this.isKeyPressed("Space");
  }
}

export const inputManager = new InputManager();
