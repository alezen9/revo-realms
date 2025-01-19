export default class InputManager {
  private keysPressed: Set<string>;
  private keyDownListeners: Map<string, VoidFunction>;
  private keyUpListeners: Map<string, VoidFunction>;

  constructor() {
    this.keysPressed = new Set();
    this.keyDownListeners = new Map();
    this.keyUpListeners = new Map();

    window.addEventListener("keydown", this.handleKeyDown.bind(this));
    window.addEventListener("keyup", this.handleKeyUp.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (!this.keysPressed.has(key)) {
      this.keysPressed.add(key);
      this.keyDownListeners.get(key)?.();
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    this.keysPressed.delete(key);
    this.keyUpListeners.get(key)?.();
  }

  public isKeyPressed(key: string): boolean {
    return this.keysPressed.has(key.toLowerCase());
  }

  public onKeyDown(key: string, callback: VoidFunction) {
    this.keyDownListeners.set(key.toLowerCase(), callback);
  }

  public onKeyUp(key: string, callback: VoidFunction) {
    this.keyUpListeners.set(key.toLowerCase(), callback);
  }

  public dispose() {
    window.removeEventListener("keydown", this.handleKeyDown.bind(this));
    window.removeEventListener("keyup", this.handleKeyUp.bind(this));
  }
}
